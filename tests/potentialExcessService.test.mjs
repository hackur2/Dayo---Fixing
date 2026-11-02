import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { createPotentialExcessService } = await vite.ssrLoadModule("/src/services/potentialExcessService.js");
const { createDashboardService } = await vite.ssrLoadModule("/src/services/dashboardService.js");
after(() => vite.close());

const now = new Date("2026-10-29T04:00:00Z");
const movement = (id, ingredientId, adjustment) => ({ id, ingredient_id: ingredientId, adjustment, reason: "Order DY-001 completed", created_at: "2026-10-28T04:00:00Z" });

function mockClient(records, failure = {}) {
  const requests = [];
  const client = createClient("https://excess-test.supabase.co", "test-only-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      const parsed = new URL(url);
      const table = parsed.pathname.split("/").at(-1);
      const offset = Number(parsed.searchParams.get("offset") || 0);
      requests.push({ table, offset, url: parsed });
      if (table === failure.table && offset === (failure.offset ?? 0)) return new Response(JSON.stringify({ message: "Test database failure" }), { status: 403 });
      if (init.method === "HEAD") return new Response(null, { headers: { "Content-Range": "*/0" } });
      let rows = records[table] ?? [];
      for (const filter of parsed.searchParams.getAll("created_at")) {
        if (filter.startsWith("gte.")) rows = rows.filter((row) => Date.parse(row.created_at) >= Date.parse(filter.slice(4)));
        if (filter.startsWith("lt.")) rows = rows.filter((row) => Date.parse(row.created_at) < Date.parse(filter.slice(3)));
      }
      if (parsed.searchParams.get("adjustment") === "lt.0") rows = rows.filter((row) => row.adjustment < 0);
      if (parsed.searchParams.has("reason")) rows = rows.filter((row) => /^Order .+ completed$/i.test(row.reason));
      const limit = Number(parsed.searchParams.get("limit") || rows.length);
      return new Response(JSON.stringify(rows.slice(offset, offset + limit)), { headers: { "Content-Type": "application/json" } });
    } },
  });
  return { client, requests };
}

test("the full excess list reconciles with the dashboard's top three estimates", async () => {
  const { client, requests } = mockClient({
    ingredients: [1, 2, 3, 4].map((id) => ({ id, name: `Ingredient ${id}`, current_stock: id * 10, unit: "pcs", expires_on: "2026-11-05" })),
    stock_movements: [movement(1, 1, -7)],
  });
  const estimate = await createPotentialExcessService(client).getEstimate(now);
  assert.equal(requests.some(({ table }) => table === "orders" || table === "menu_items"), false);
  const dashboard = await createDashboardService(client).getDashboardSummary(now);
  assert.equal(estimate.items.length, 4);
  assert.deepEqual(estimate.items.slice(0, 3), dashboard.potentialExcess.items);
  assert.equal(estimate.asOfDate, "2026-10-29");
  assert.equal(estimate.items.find((item) => item.id === 1).weeklyConsumption, 7);
  assert.equal(estimate.items.find((item) => item.id === 1).potentialExcess, 3);
  const query = requests.find((request) => request.table === "stock_movements").url.searchParams;
  assert.deepEqual(query.getAll("created_at"), ["gte.2026-10-22T00:00:00+08:00", "lt.2026-10-29T00:00:00+08:00"]);
  assert.equal(query.get("adjustment"), "lt.0");
  assert.equal(query.get("reason"), "ilike.Order % completed");
});

test("all pages of ingredient stock and consumption are loaded beyond the database row limit", async () => {
  const count = 1001;
  const { client, requests } = mockClient({
    ingredients: Array.from({ length: count }, (_, index) => ({ id: index + 1, current_stock: 20, expires_on: "2026-11-05" })),
    stock_movements: Array.from({ length: count }, (_, index) => movement(index + 1, count, -0.01)),
  });
  const estimate = await createPotentialExcessService(client).getEstimate(now);
  assert.equal(estimate.items.length, count);
  assert.ok(Math.abs(estimate.items.find((item) => item.id === count).weeklyConsumption - 10.01) < 1e-8);
  assert.ok(Math.abs(estimate.items.find((item) => item.id === count).potentialExcess - 9.99) < 1e-8);
  for (const table of ["ingredients", "stock_movements"]) assert.deepEqual(requests.filter((request) => request.table === table).map((request) => request.offset), [0, 1000]);
});

test("a later page failure rejects estimates instead of reporting partial stock", async () => {
  const { client } = mockClient({ ingredients: Array.from({ length: 1001 }, (_, id) => ({ id })) }, { table: "ingredients", offset: 1000 });
  await assert.rejects(createPotentialExcessService(client).getEstimate(now), { message: "Test database failure" });
});

test("an empty catalogue yields an empty full list", async () => {
  const { client } = mockClient({});
  const estimate = await createPotentialExcessService(client).getEstimate(now);
  assert.deepEqual(estimate.items, []);
  assert.equal(estimate.consumptionDays, 7);
});

test("a later consumption-page failure rejects estimates instead of inventing zero consumption", async () => {
  const { client } = mockClient({ stock_movements: Array.from({ length: 1001 }, (_, index) => movement(index + 1, 1, -1)) }, { table: "stock_movements", offset: 1000 });
  await assert.rejects(createPotentialExcessService(client).getEstimate(now), { message: "Test database failure" });
});

test("expired archives are excluded from current excess estimates", async () => {
  const { client } = mockClient({ ingredients: [{ id: 1, name: "Archived", current_stock: 0, expires_on: "2026-10-29", archived_at: "2026-10-29T00:00:00Z" }, { id: 2, name: "Active", current_stock: 10, expires_on: "2026-11-05" }] });
  assert.deepEqual((await createPotentialExcessService(client).getEstimate(now)).items.map((row) => row.id), [2]);
});
