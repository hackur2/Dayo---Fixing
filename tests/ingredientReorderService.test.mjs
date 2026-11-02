import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" });
const { getIngredientSales30Days } = await vite.ssrLoadModule("/src/services/ingredientReorderService.js");
after(() => vite.close());
const now = new Date("2026-10-30T04:00:00Z");

function mockClient(records, failureOffset = null, rpcError = null) {
  const requests = [];
  const client = createClient("https://rop-test.supabase.co", "test-only-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url) => {
      const request = new URL(url);
      requests.push(request);
      if (request.pathname.includes("/rpc/")) return new Response(JSON.stringify(rpcError ?? 0), { status: rpcError ? 404 : 200, headers: { "Content-Type": "application/json" } });
      const offset = Number(request.searchParams.get("offset") ?? 0);
      const failed = offset === failureOffset;
      return new Response(JSON.stringify(failed ? { message: "Sales history unavailable" } : records.slice(offset, offset + 1000)), { status: failed ? 403 : 200, headers: { "Content-Type": "application/json" } });
    } },
  });
  return { client, requests };
}

test("ROP loads every sales-history page and uses the rolling 30-day bounds", async () => {
  const { client, requests } = mockClient(Array.from({ length: 1001 }, (_, id) => ({ id, ingredient_id: 1, adjustment: -0.01, reason: "Order DY-123 completed", created_at: "2026-10-29T04:00:00Z" })));
  const sales = await getIngredientSales30Days(client, now);
  assert.ok(Math.abs(sales.get("1") - 10.01) < 1e-9);
  const queries = requests.filter((url) => url.pathname.endsWith("stock_movements"));
  assert.deepEqual(queries.map((url) => url.searchParams.get("offset")), ["0", "1000"]);
  assert.deepEqual(queries[0].searchParams.getAll("created_at"), ["gte.2026-09-30T04:00:00.000Z", "lte.2026-10-30T04:00:00.000Z"]);
  assert.equal(queries[0].searchParams.get("adjustment"), "lt.0");
  assert.equal(queries[0].searchParams.get("reason"), "ilike.Order % completed");
});

test("missing optional SQL automation still calculates from the ledger; real history failures reject", async () => {
  const { client } = mockClient([], null, { code: "PGRST202", message: "Function not installed" });
  assert.equal((await getIngredientSales30Days(client, now)).size, 0);
  const failed = mockClient(Array.from({ length: 1000 }, (_, id) => ({ id })), 1000);
  await assert.rejects(getIngredientSales30Days(failed.client, now), { message: "Sales history unavailable" });
  const denied = mockClient([], null, { code: "42501", message: "Not authorized" });
  await assert.rejects(getIngredientSales30Days(denied.client, now), { message: "Not authorized" });
});
