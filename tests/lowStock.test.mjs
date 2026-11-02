import assert from "node:assert/strict";
import test from "node:test";
import { getLowStockRows } from "../src/utils/lowStockUtils.js";

const ingredient = (id, name, stock, reorder = 5) => ({
  id, name, currentStock: stock, reorderLevel: reorder, unit: "kg", expiresOn: "2026-11-10",
});

test("the list uses the Dashboard and Inventory low-stock rule, including the reorder boundary", () => {
  const ingredients = [
    ingredient(1, "Rice", 5), ingredient(2, "Garlic", 2),
    ingredient(3, "Beef", 0), ingredient(4, "Coffee", -1), ingredient(5, "Tea", 6),
  ];
  const rows = getLowStockRows(ingredients, []);
  assert.deepEqual(rows.map(({ name }) => name), ["Garlic", "Rice"]);
  assert.equal(rows[0].expiresOn, "2026-11-10");
  assert.equal(rows[0].reorderLevel, 5);
  assert.deepEqual(ingredients.map(({ id }) => id), [1, 2, 3, 4, 5]);
});

test("supplier numbers match the ingredient rather than a supplier's name or directory order", () => {
  const suppliers = [
    { id: 1, name: "Rice", ingredient: "Tea", mobile: "09170000001" },
    { id: 2, name: "Trading A", ingredient: " RICE ", mobile: "09170000002", displayId: "SUP-002" },
    { id: 3, name: "Trading B", ingredient: "Rice", mobile: "09170000003", displayId: "SUP-003" },
  ];
  const [row] = getLowStockRows([ingredient(1, "Rice", 2)], suppliers);
  assert.deepEqual(row.suppliers.map(({ mobile }) => mobile), ["09170000002", "09170000003"]);
  assert.equal(row.suppliers[0].displayId, "SUP-002");
});

test("all low-stock ingredients remain visible, including those without suppliers and beyond ten rows", () => {
  const ingredients = Array.from({ length: 14 }, (_, index) => ingredient(index, `Ingredient ${index}`, 1));
  const rows = getLowStockRows(ingredients, []);
  assert.equal(rows.length, 14);
  assert.equal(rows.every(({ suppliers }) => suppliers.length === 0), true);
});

test("restocked ingredients leave the list while saved reorder and expiration values remain", () => {
  const before = [ingredient(1, "Rice", 2), ingredient(2, "Garlic", 3)];
  assert.equal(getLowStockRows(before, []).length, 2);
  const after = [{ ...before[0], currentStock: 20 }, { ...before[1], reorderLevel: 8, expiresOn: "2026-12-01" }];
  const [remaining] = getLowStockRows(after, []);
  assert.equal(remaining.id, 2);
  assert.equal(remaining.reorderLevel, 8);
  assert.equal(remaining.expiresOn, "2026-12-01");
});
