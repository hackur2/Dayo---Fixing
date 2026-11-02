import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServer } from "vite";
import { getExpiryReminders } from "../src/utils/ingredientExpiryUtils.js";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { synchronizeIngredientExpiry } = await vite.ssrLoadModule("/src/services/ingredientExpiryService.js");
after(() => vite.close());
const now = new Date("2026-10-29T04:00:00Z");
const ingredient = (id, expiresOn, extra = {}) => ({ id, name: `Ingredient ${id}`, current_stock: 10, expires_on: expiresOn, unit: "kg", ...extra });

test("reminders show only stocked, active ingredients with one to three days remaining", () => {
  const rows = getExpiryReminders([
    ingredient(1, "2026-11-01"), ingredient(2, "2026-10-31"), ingredient(3, "2026-10-30"),
    ingredient(4, "2026-11-02"), ingredient(5, "2026-10-29"), ingredient(6, "2026-10-28"),
    ingredient(7, "2026-10-30", { current_stock: 0 }), ingredient(8, "2026-10-30", { archived_at: "2026-10-29" }),
    ingredient(9, ""), ingredient(10, "2026-02-30"), ingredient(11, "2026-10-30", { current_stock: "bad" }),
  ], now);
  assert.deepEqual(rows.map((row) => [row.id, row.daysUntilExpiry]), [[3, 1], [2, 2], [1, 3]]);
});

test("reminder dates change at Philippine midnight rather than UTC midnight", () => {
  const rows = [ingredient(1, "2026-11-01")];
  assert.equal(getExpiryReminders(rows, new Date("2026-10-29T15:59:59Z"))[0].daysUntilExpiry, 3);
  assert.equal(getExpiryReminders(rows, new Date("2026-10-29T16:00:00Z"))[0].daysUntilExpiry, 2);
  assert.deepEqual(getExpiryReminders(rows, new Date("2026-10-31T16:00:00Z")), []);
});

test("concurrent readers share one atomic expiry RPC and cached reads do not re-announce stock changes", async () => {
  let resolve; let calls = 0;
  const client = { rpc: (name) => { assert.equal(name, "zero_expired_ingredient_stock"); calls += 1; return new Promise((done) => { resolve = done; }); } };
  const first = synchronizeIngredientExpiry(client, now);
  const second = synchronizeIngredientExpiry(client, now);
  assert.equal(calls, 1);
  resolve({ data: [41], error: null });
  assert.deepEqual(await first, { configured: true, updatedIds: [41] });
  assert.deepEqual(await second, { configured: true, updatedIds: [41] });
  assert.deepEqual(await synchronizeIngredientExpiry(client, now), { configured: true, updatedIds: [] });
  assert.equal(calls, 1);
});

test("missing setup is reported without a direct-delete or client-side stock fallback", async () => {
  let calls = 0;
  const client = { rpc: async () => { calls += 1; return { error: { code: "PGRST202", message: "Function not found" } }; } };
  assert.deepEqual(await synchronizeIngredientExpiry(client, now), { configured: false, updatedIds: [] });
  assert.equal(calls, 1);
});

test("permission and database failures reject the check and allow a later retry", async () => {
  let calls = 0;
  const client = { rpc: async () => { calls += 1; return calls === 1 ? { error: { code: "42501", message: "Not allowed" } } : { data: [] }; } };
  await assert.rejects(synchronizeIngredientExpiry(client, now), { message: "Not allowed" });
  assert.deepEqual(await synchronizeIngredientExpiry(client, now), { configured: true, updatedIds: [] });
});

test("a date rollover forces a fresh check even inside the short request cache", async () => {
  let calls = 0;
  const client = { rpc: async () => { calls += 1; return { data: [] }; } };
  await synchronizeIngredientExpiry(client, new Date("2026-10-29T15:59:59Z"));
  await synchronizeIngredientExpiry(client, new Date("2026-10-29T16:00:00Z"));
  assert.equal(calls, 2);
});

