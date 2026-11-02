import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { createIngredientArchiveService } = await vite.ssrLoadModule("/src/services/ingredientArchiveService.js");
after(() => vite.close());

function mockApi({ archives = [], deletedId = 41, rpcError, readError } = {}) {
  const requests = [];
  const client = createClient("https://archive-test.supabase.co", "test-only-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      const query = new URL(url);
      requests.push({ query, method: init.method, body: init.body ? JSON.parse(init.body) : null });
      const isRpc = query.pathname.includes("/rpc/");
      const error = isRpc ? rpcError : readError;
      if (error) return new Response(JSON.stringify(error), { status: 400, headers: { "Content-Type": "application/json" } });
      const offset = Number(query.searchParams.get("offset") || 0);
      const limit = Number(query.searchParams.get("limit") || archives.length);
      return new Response(JSON.stringify(isRpc ? deletedId : archives.slice(offset, offset + limit)), { headers: { "Content-Type": "application/json" } });
    } },
  });
  return { service: createIngredientArchiveService(client), requests };
}

test("archive reads the saved ingredient snapshot with archive identity and deletion date", async () => {
  const { service, requests } = mockApi({ archives: [{
    id: "archive-1", ingredient_id: 41, archived_at: "2026-10-28T04:00:00Z",
    ingredient_data: { id: 41, name: "Rice", category: "Grains", current_stock: "12.5", reorder_level: "3", unit: "kg", expires_on: "2026-11-01", updated_at: "2026-10-27T04:00:00Z" },
  }] });
  const [row] = await service.getArchivedIngredients();
  assert.equal(row.id, "archive-1");
  assert.equal(row.ingredientId, 41);
  assert.equal(row.name, "Rice");
  assert.equal(row.currentStock, 12.5);
  assert.equal(row.reorderLevel, 3);
  assert.equal(row.expiresOn, "2026-11-01");
  assert.equal(row.archivedAt, "2026-10-28T04:00:00Z");
  assert.match(requests[0].query.pathname, /ingredient_archives$/);
  assert.equal(requests[0].query.searchParams.get("order"), "archived_at.desc,id.desc");
});

test("archive pagination includes records beyond the first API page", async () => {
  const { service, requests } = mockApi({ archives: Array.from({ length: 1001 }, (_, id) => ({ id, ingredient_id: id, ingredient_data: { name: `Ingredient ${id}` } })) });
  assert.equal((await service.getArchivedIngredients()).length, 1001);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].query.searchParams.get("offset"), "1000");
});

test("ingredient deletion uses only the atomic archive RPC", async () => {
  const { service, requests } = mockApi();
  await service.deleteIngredient(41);
  assert.equal(requests.length, 1);
  assert.match(requests[0].query.pathname, /rpc\/delete_ingredient_to_archive$/);
  assert.equal(requests[0].method, "POST");
  assert.deepEqual(requests[0].body, { p_ingredient_id: 41 });
});

test("missing archive setup blocks deletion without a permanent-delete fallback", async () => {
  const { service, requests } = mockApi({ rpcError: { code: "PGRST202", message: "Function not found" } });
  await assert.rejects(service.deleteIngredient(41), /Complete the database setup before archiving ingredients/);
  assert.equal(requests.length, 1);
  assert.equal(requests.some(({ method }) => method === "DELETE"), false);
});

test("failed or unconfirmed deletions stay failed", async () => {
  const { service } = mockApi({ rpcError: { code: "P0001", message: "This ingredient has stock movement history and cannot be deleted." } });
  await assert.rejects(service.deleteIngredient(41), { message: "This ingredient has stock movement history and cannot be archived." });
  const unconfirmed = mockApi({ deletedId: null });
  await assert.rejects(unconfirmed.service.deleteIngredient(41), /not archived/);
});

test("empty archives stay empty and read failures are reported", async () => {
  assert.deepEqual(await mockApi().service.getArchivedIngredients(), []);
  const unavailable = mockApi({ readError: { code: "PGRST205", message: "Table not found" } });
  await assert.rejects(unavailable.service.getArchivedIngredients(), /Archive is not available yet/);
});

test("automatic expiry archives retain the removed quantity and expiry reason", async () => {
  const { service } = mockApi({ archives: [{ id: "expired-1", ingredient_id: 5, archived_at: "2026-10-29T00:00:00Z", archive_reason: "expired", ingredient_data: { id: 5, name: "Milk", current_stock: 7, unit: "L", expires_on: "2026-10-29" } }] });
  const [row] = await service.getArchivedIngredients();
  assert.equal(row.archiveReason, "expired");
  assert.equal(row.currentStock, 7);
  assert.equal(row.name, "Milk");
});

test("reverted expiry archives leave the Archive list while manual deletions remain", async () => {
  const { service } = mockApi({ archives: [
    { id: "restored", ingredient_id: 1, archive_reason: "expired", restored_at: "2026-10-29T00:00:00Z", ingredient_data: { name: "Restored Milk" } },
    { id: "manual", ingredient_id: 2, archive_reason: "deleted", ingredient_data: { name: "Deleted Salt" } },
  ] });
  assert.deepEqual((await service.getArchivedIngredients()).map((row) => row.name), ["Deleted Salt"]);
});
