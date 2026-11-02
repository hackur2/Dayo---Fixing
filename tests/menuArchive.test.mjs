import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { createMenuArchiveService } = await vite.ssrLoadModule("/src/services/menuArchiveService.js");
const { renderArchiveView } = await vite.ssrLoadModule("/tests/helpers/archiveRenderFixture.jsx");
after(() => vite.close());

const menu = (id, active = true) => ({
  id, name: `Menu ${id}`, item_type: "Ala Carte", price: "75.00", is_active: active, is_available: true,
  category_id: 1, subcategory_id: 2, updated_at: "2026-10-31T00:00:00Z",
  menu_item_ingredients: [{ ingredient_id: 7, quantity: 2 }],
  menu_item_variants: [{ id: 9, variant_key: "large", name: "Large", price: 100 }],
});

function fixture({ items = [menu(41)], activeCombo = false, errorAt, unconfirmed = false } = {}) {
  const state = { items: structuredClone(items), recipes: [{ menu_item_id: 41, ingredient_id: 7 }],
    orders: [{ id: 8, menu_item_id: 41, item_name: "Order-time name" }] };
  const requests = [];
  const client = createClient("https://menu-archive-test.supabase.co", "test-only-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      const query = new URL(url);
      const table = query.pathname.split("/").at(-1);
      const body = init.body ? JSON.parse(init.body) : null;
      requests.push({ query, method: init.method, body });
      assert.notEqual(init.method, "DELETE", "Archiving must never permanently delete a row");
      if (errorAt === table) return new Response(JSON.stringify({ code: "42501", message: "Permission denied" }),
        { status: 403, headers: { "Content-Type": "application/json" } });
      let data;
      if (table === "combo_components") {
        assert.equal(query.searchParams.get("combo.is_active"), "eq.true");
        data = activeCombo ? [{ combo_menu_item_id: 55, combo: { is_active: true } }] : [];
      } else {
        assert.equal(table, "menu_items");
        if (init.method === "PATCH") {
          assert.deepEqual(body, { is_active: false, is_available: false });
          const id = query.searchParams.get("id").replace("eq.", "");
          const row = state.items.find((item) => String(item.id) === id);
          if (row && !unconfirmed) Object.assign(row, body);
          data = row && !unconfirmed ? { id: row.id, is_active: row.is_active } : null;
        } else {
          const active = query.searchParams.get("is_active") === "eq.true";
          const offset = Number(query.searchParams.get("offset") ?? 0);
          const limit = Number(query.searchParams.get("limit") ?? 1000);
          data = state.items.filter((item) => item.is_active === active).slice(offset, offset + limit);
        }
      }
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    } },
  });
  return { service: createMenuArchiveService(client), state, requests };
}

test("archiving moves only the selected menu item to Archive and preserves recipes, variants and order references", async () => {
  const { service, state, requests } = fixture({ items: [menu(41), menu(42)] });
  const before = structuredClone(state);
  await service.archiveMenuItem(41);
  assert.deepEqual(state.recipes, before.recipes);
  assert.deepEqual(state.orders, before.orders);
  assert.deepEqual(state.items[0], { ...before.items[0], is_active: false, is_available: false });
  assert.deepEqual(state.items[1], before.items[1]);
  assert.deepEqual((await service.getActiveMenuItems()).map((row) => row.id), [42]);
  const [archived] = await service.getArchivedMenuItems();
  assert.equal(archived.id, 41);
  assert.deepEqual(archived.variants, before.items[0].menu_item_variants);
  assert.deepEqual(archived.ingredientRequirements, [{ ingredientId: 7, quantity: 2 }]);
  assert.equal(archived.lastUpdated, before.items[0].updated_at);
  await service.archiveMenuItem(41);
  assert.equal((await service.getArchivedMenuItems()).length, 1);
  assert.equal(requests.some((request) => request.method === "DELETE"), false);
});

test("active combo dependencies block archiving; inactive combos do not block it", async () => {
  const protectedItem = fixture({ activeCombo: true });
  await assert.rejects(protectedItem.service.archiveMenuItem(41), /Archive that combo first/);
  assert.equal(protectedItem.requests.some((request) => request.method === "PATCH"), false);
  assert.equal(protectedItem.state.items[0].is_active, true);
  const inactiveCombo = fixture();
  await inactiveCombo.service.archiveMenuItem(41);
  assert.equal(inactiveCombo.state.items[0].is_active, false);
});

test("reference and update permission errors and unconfirmed updates remain failures", async () => {
  for (const errorAt of ["combo_components", "menu_items"]) {
    const { service, state } = fixture({ errorAt });
    await assert.rejects(service.archiveMenuItem(41), { code: "42501", message: "Permission denied" });
    assert.equal(state.items[0].is_active, true);
  }
  const { service, state } = fixture({ unconfirmed: true });
  await assert.rejects(service.archiveMenuItem(41), /not archived/);
  assert.equal(state.items[0].is_active, true);
});

test("archive reads paginate beyond 1000 rows and keep active items out", async () => {
  const { service, requests } = fixture({ items: [menu(0), ...Array.from({ length: 1001 }, (_, id) => menu(id + 1, false))] });
  assert.equal((await service.getArchivedMenuItems()).length, 1001);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].query.searchParams.get("offset"), "1000");
  assert.equal(requests[0].query.searchParams.get("order"), "name.asc,id.asc");
  const failed = fixture({ errorAt: "menu_items" });
  await assert.rejects(failed.service.getArchivedMenuItems(), { code: "42501", message: "Permission denied" });
});

test("the existing Archive route supports both toggle views and returns to the selected inventory page", () => {
  for (const [view, heading, backView] of [["ingredients", "Archived Ingredients", "ingredients"], ["menuItems", "Archived Menu Items", "menuItems"]]) {
    const html = renderArchiveView(view);
    assert.match(html, /aria-label="Archived item type"/);
    assert.ok(html.includes(heading));
    assert.ok(html.includes(`/super-admin/inventory?view=${backView}`));
    assert.match(html, /aria-pressed="true"/);
    assert.equal(html.includes("Manually deleted"), false);
  }
});
