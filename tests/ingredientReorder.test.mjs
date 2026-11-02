import assert from "node:assert/strict";
import test from "node:test";
import { applyIngredientReorderPoints, calculateIngredientReorderPoint, getIngredientSalesTotals, getIngredientSalesWindow } from "../src/utils/ingredientReorderUtils.js";
import { createIngredientPayload, normalizeIngredient } from "../src/adapters/inventoryAdapter.js";
import { getStockStatus } from "../src/utils/inventoryUtils.js";

const now = new Date("2026-10-30T04:00:00Z");
const movement = (id, adjustment, created_at = "2026-10-29T04:00:00Z", reason = "Order DY-123 completed") => ({ ingredient_id: id, adjustment, created_at, reason });

test("ADS uses a fixed 30-day divisor, one lead-time day and one buffer day", () => {
  assert.deepEqual(calculateIngredientReorderPoint(300), { quantitySold30Days: 300, averageDailySales: 10, safetyStock: 10, reorderPoint: 20, reorderLevel: 20 });
  assert.deepEqual(calculateIngredientReorderPoint(15), { quantitySold30Days: 15, averageDailySales: 0.5, safetyStock: 0.5, reorderPoint: 1, reorderLevel: 1 });
  assert.equal(calculateIngredientReorderPoint(0).reorderLevel, 0);
  assert.throws(() => calculateIngredientReorderPoint(-1));
  assert.throws(() => calculateIngredientReorderPoint(NaN));
});

test("fractional stock keeps full ADS precision and rounds the final ROP upward to 0.001 units", () => {
  const result = calculateIngredientReorderPoint(1);
  assert.equal(result.averageDailySales, 1 / 30);
  assert.equal(result.reorderPoint, 1 / 15);
  assert.equal(result.reorderLevel, 0.067);
  assert.equal(calculateIngredientReorderPoint(0.001).reorderLevel, 0.001);
  for (let thousandths = 1; thousandths < 1000; thousandths++) {
    assert.equal(calculateIngredientReorderPoint(thousandths / 1000).reorderLevel, Math.ceil(thousandths / 15) / 1000);
  }
});

test("the rolling 30-day window includes its bounds and current-day sales, without manual or expiry losses", () => {
  assert.deepEqual(getIngredientSalesWindow(now), { start: "2026-09-30T04:00:00.000Z", end: "2026-10-30T04:00:00.000Z" });
  const totals = getIngredientSalesTotals([
    movement(1, -3, "2026-09-30T04:00:00Z"), movement(1, -6, now.toISOString()),
    movement(1, -100, "2026-09-30T03:59:59Z"), movement(1, -100, "2026-10-30T04:00:01Z"),
    movement(1, 100), movement(1, -50, undefined, "Manual stock adjustment"),
    movement(1, -20, undefined, "Inventory record edit"), movement(1, -30, undefined, "Expired ingredient stock cleared"),
    movement(1, -30, "invalid"), movement(2, -0.5),
  ], now);
  assert.deepEqual([...totals], [["1", 9], ["2", 0.5]]);
});

test("ingredients use calculated ROP for low-stock classification, ignoring old manually entered levels", () => {
  const input = [{ id: 1, name: "Rice", current_stock: 20, reorder_level: 999, unit: "kg" }, { id: 2, current_stock: 1, reorder_level: 999 }];
  const original = structuredClone(input);
  const rows = applyIngredientReorderPoints(input, new Map([["1", 300]]), now).map(normalizeIngredient);
  assert.equal(rows[0].reorderLevel, 20);
  assert.equal(rows[0].averageDailySales, 10);
  assert.equal(rows[0].safetyStock, 10);
  assert.equal(rows[0].quantitySold30Days, 300);
  assert.equal(getStockStatus(rows[0]), "Low Stock");
  assert.equal(rows[1].reorderLevel, 0);
  assert.equal(getStockStatus(rows[1]), "In Stock");
  assert.deepEqual(input, original);
  assert.equal(createIngredientPayload({ name: "New", unit: "Grams", currentStock: 5, reorderLevel: 999 }).reorderLevel, 0);
});
