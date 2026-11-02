import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" });
const { getShelfLifeRows } = await vite.ssrLoadModule("/src/utils/shelfLifeUtils.js");
const { createShelfLifeService } = await vite.ssrLoadModule("/src/services/shelfLifeService.js");
after(() => vite.close());

test("shelf list places expiring soon before expired, then fresh, with undated records last", () => {
  const ingredients = [
    { id: 1, name: "Rice", currentStock: 10, expiresOn: "2026-11-30" },
    { id: 2, name: "Milk", currentStock: 5, expiresOn: "2026-10-29" },
    { id: 3, name: "Fish", currentStock: 2, expiresOn: "2026-10-26" },
    { id: 4, name: "Salt", currentStock: 3, expiresOn: "" },
    { id: 5, name: "Eggs", currentStock: 5, expiresOn: "2026-10-28" },
    { id: 6, name: "Beef", currentStock: 1, expiresOn: "2026-10-27" },
    { id: 7, name: "Invalid date", currentStock: 1, expiresOn: "2026-02-30" },
    { id: 8, name: "Empty", currentStock: 0, expiresOn: "2026-10-25" },
  ];
  const original = structuredClone(ingredients);
  const rows = getShelfLifeRows(ingredients, "2026-10-28");
  assert.deepEqual(rows.map((row) => row.id), [5, 2, 3, 6, 1, 7, 4]);
  assert.deepEqual(rows.map((row) => row.status), ["Expiring Soon", "Expiring Soon", "Expired", "Expired", "Fresh", "Not Set", "Not Set"]);
  assert.deepEqual(rows.map((row) => row.daysUntilExpiry), [0, 1, -2, -1, 33, null, null]);
  assert.equal(rows[5].expiresOn, "");
  assert.deepEqual(ingredients, original);
});

test("matching expiry dates always use ingredient name and id as tie breakers", () => {
  const ingredient = (id, name) => ({ id, name, currentStock: 1, expiresOn: "2026-11-11" });
  const rows = getShelfLifeRows([ingredient(3, "Zucchini"), ingredient(2, "Apple"), ingredient(1, "Apple")], "2026-10-28");
  assert.deepEqual(rows.map((row) => row.id), [1, 2, 3]);
  assert.equal(rows.every((row) => row.status === "Expiring Soon"), true);
});

function mockService(records, failOffset = null) {
  const requests = [];
  const client = createClient("https://shelf-test.supabase.co", "test-only-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url) => {
      const query = new URL(url);
      requests.push(query);
      const offset = Number(query.searchParams.get("offset") || 0);
      if (offset === failOffset) return new Response(JSON.stringify({ message: "Cannot read inventory" }), { status: 403 });
      const limit = Number(query.searchParams.get("limit"));
      return new Response(JSON.stringify(records.slice(offset, offset + limit)), { headers: { "Content-Type": "application/json" } });
    } },
  });
  return { service: createShelfLifeService(client), requests };
}

test("shelf page loads every inventory page and normalizes expiry and stock fields", async () => {
  const ingredients = Array.from({ length: 1001 }, (_, index) => ({
    id: index + 1, name: `Ingredient ${index + 1}`, current_stock: "10", unit: "kg", expires_on: "2026-11-01",
  }));
  const { service, requests } = mockService(ingredients);
  const rows = await service.getIngredients();
  assert.equal(rows.length, 1001);
  assert.equal(rows.at(-1).currentStock, 10);
  assert.equal(rows.at(-1).expiresOn, "2026-11-01");
  const inventoryRequests = requests.filter((url) => url.pathname.endsWith("/ingredients"));
  assert.equal(inventoryRequests.length, 2);
  assert.equal(inventoryRequests[1].searchParams.get("offset"), "1000");
  assert.equal(inventoryRequests[1].searchParams.get("order"), "id.asc");
});

test("a later inventory page failure rejects the list instead of showing partial data", async () => {
  const { service } = mockService(Array.from({ length: 1000 }, (_, id) => ({ id })), 1000);
  await assert.rejects(service.getIngredients(), { message: "Cannot read inventory" });
});

test("empty inventory and out-of-stock records leave the monitoring list empty", async () => {
  const { service } = mockService([]);
  assert.deepEqual(await service.getIngredients(), []);
  assert.deepEqual(getShelfLifeRows([{ id: 1, name: "Rice", currentStock: 0, expiresOn: "2026-11-01" }], "2026-10-28"), []);
});

test("automatically archived ingredients leave the active shelf-life list", async () => {
  const { service } = mockService([{ id: 1, name: "Expired", current_stock: 0, archived_at: "2026-10-29T00:00:00Z" }, { id: 2, name: "Fresh", current_stock: 5, expires_on: "2026-11-01" }]);
  assert.deepEqual((await service.getIngredients()).map((row) => row.id), [2]);
});
