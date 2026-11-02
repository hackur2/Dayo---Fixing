import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";

const ingredients = [{ id: 1, name: "Rice", unit: "Grams", category: "Food Ingredient", current_stock: 100, reorder_level: 999 }];
const movements = [{ id: 1, ingredient_id: 1, adjustment: -300, reason: "Order DY-123 completed", created_at: new Date(Date.now() - 86400000).toISOString() }];
const writes = [];
const client = createClient("https://inventory-reorder-test.supabase.co", "test-only-key", {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: async (url, init) => {
    const parsed = new URL(url);
    const table = parsed.pathname.split("/").at(-1);
    if (parsed.pathname.includes("/rpc/")) return new Response(JSON.stringify(table === "refresh_ingredient_reorder_points" ? 0 : []), { headers: { "Content-Type": "application/json" } });
    let rows = table === "ingredients" ? ingredients : movements;
    const id = parsed.searchParams.get("id")?.replace("eq.", "");
    if (id) rows = rows.filter((row) => String(row.id) === id);
    if (init.method === "PATCH") {
      const values = JSON.parse(init.body);
      writes.push({ table, values });
      rows.forEach((row) => Object.assign(row, values));
    } else if (init.method === "POST") {
      const values = JSON.parse(init.body);
      writes.push({ table, values });
      const row = { id: table === "ingredients" ? ingredients.length + 1 : movements.length + 1, created_at: new Date().toISOString(), ...values };
      (table === "ingredients" ? ingredients : movements).push(row);
      rows = [row];
    }
    const single = new Headers(init.headers).get("accept")?.includes("vnd.pgrst.object+json");
    return new Response(JSON.stringify(single ? rows[0] : rows), { headers: { "Content-Type": "application/json" } });
  } },
});
globalThis.__ingredientReorderTestClient = client;
const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", plugins: [{
  name: "inventory-reorder-test-client", enforce: "pre",
  resolveId(source) { if (/lib\/supabase(?:\.js)?$/.test(source)) return "\0inventory-reorder-client"; },
  load(id) { if (id === "\0inventory-reorder-client") return "export const supabase=globalThis.__ingredientReorderTestClient; export const isSupabaseConfigured=true;"; },
}] });
const { inventoryService } = await vite.ssrLoadModule("/src/services/inventoryService.js");
after(async () => { await vite.close(); delete globalThis.__ingredientReorderTestClient; });

test("inventory reads and edits use current 30-day consumption instead of caller-supplied reorder levels", async () => {
  const [rice] = await inventoryService.getIngredients();
  assert.equal(rice.reorder_level, 20);
  assert.equal(rice.average_daily_sales, 10);
  assert.equal(rice.safety_stock, 10);
  const saved = await inventoryService.updateIngredient(1, { name: "Rice", category: "Food Ingredient", unit: "Grams", currentStock: 100, reorderLevel: 999 });
  assert.equal(saved.reorder_level, 20);
  assert.equal(writes.find(({ table }) => table === "ingredients").values.reorder_level, 20);
  const stock = await inventoryService.updateIngredientStock(1, { adjustmentAmount: 5 });
  assert.equal(stock.current_stock, 105);
  assert.equal(stock.quantity_sold_30_days, 300);
  assert.equal(stock.reorder_level, 20);
});

test("a new ingredient saves zero calculated ROP until completed orders record consumption", async () => {
  const ingredient = await inventoryService.createIngredient({ name: "Salt", category: "Food Ingredient", unit: "Grams", currentStock: 10, reorderLevel: 999 });
  assert.equal(ingredient.reorder_level, 0);
  assert.equal(ingredient.average_daily_sales, 0);
  assert.equal(ingredient.safety_stock, 0);
});

test("all dropdown units persist on creation and editing; custom or blank units never write", async () => {
  for (const unit of ["Pcs", "Grams", "mL"]) {
    const row = await inventoryService.createIngredient({ name: `Ingredient ${unit}`, unit, currentStock: 0.125 });
    assert.equal(row.unit, unit);
    const saved = await inventoryService.updateIngredient(row.id, { name: row.name, unit, currentStock: 1.5 });
    assert.equal(saved.unit, unit);
    assert.equal(saved.current_stock, 1.5);
  }
  for (const unit of ["", null, "kg", "packs", "grams"]) {
    const before = writes.length;
    await assert.rejects(inventoryService.createIngredient({ name: "Invalid", unit }), /Select a Unit of Measure/);
    await assert.rejects(inventoryService.updateIngredient(1, { unit }), /Select a Unit of Measure/);
    assert.equal(writes.length, before);
  }
});

test("editing the unit cannot relabel existing stock and consumption into a different dimension", async () => {
  const before = writes.length;
  await assert.rejects(inventoryService.updateIngredient(1, { name: "Rice", unit: "mL", currentStock: 100 }), /same unit/);
  assert.equal(writes.length, before);
});
