import assert from "node:assert/strict";
import test from "node:test";
import { buildItemMovement, buildSalesReport } from "../src/utils/salesReportUtils.js";

const menuItem = (id, quantitySold, categoryId = "category:1") => ({ id, name: `Menu ${id}`, quantitySold, categoryId, categoryName: categoryId });

test("popularity uses the 70% expected-share threshold and retains the full list beyond preview limits", () => {
  const input = [120, 90, 80, 60, 50].map((quantity, index) => menuItem(index, quantity));
  const original = structuredClone(input);
  const result = buildItemMovement(input);
  assert.deepEqual(result.items.map(({ popularity }) => popularity), [30, 22.5, 20, 15, 12.5]);
  assert.equal(result.items.every(({ threshold }) => threshold === 14), true);
  assert.deepEqual(result.items.map(({ classification }) => classification), ["Fast-moving", "Fast-moving", "Fast-moving", "Fast-moving", "Slow-moving"]);
  assert.deepEqual(result.data.map(({ quantitySold }) => quantitySold), [120, 90, 80, 50]);
  assert.deepEqual(input, original);
});

test("each category has its own denominator and counts its zero-selling menu items", () => {
  const result = buildItemMovement([
    menuItem(1, 100, "a"), menuItem(2, 1, "a"),
    menuItem(3, 5, "b"), menuItem(4, 2, "b"), menuItem(5, 1, "b"), menuItem(6, 0, "b"), menuItem(7, 0, "b"),
  ]);
  const byId = (id) => result.items.find((item) => item.id === id);
  assert.equal(byId(1).threshold, 35);
  assert.equal(byId(1).categoryUnitsSold, 101);
  assert.equal(byId(4).popularity, 25);
  assert.equal(byId(4).movement, "fast");
  assert.equal(byId(5).popularity, 12.5);
  assert.equal(byId(5).threshold, 14);
  assert.equal(byId(5).movement, "slow");
  assert.equal(byId(6).classification, "Non-moving");
});

test("an exact threshold tie is fast-moving and display rounding cannot turn a slow item fast", () => {
  const tied = buildItemMovement([14, 86, 0, 0, 0].map((quantity, id) => menuItem(id, quantity)));
  assert.equal(tied.items.find(({ id }) => id === 0).movement, "fast");
  const rounded = buildItemMovement([13999, 86001, 0, 0, 0].map((quantity, id) => menuItem(id, quantity)));
  const item = rounded.items.find(({ id }) => id === 0);
  assert.equal(item.popularity.toFixed(2), "14.00");
  assert.equal(item.movement, "slow");
});

test("previews contain at most three per class and never include non-moving items", () => {
  const result = buildItemMovement([100, 90, 80, 70, 6, 5, 4, 3, 2, 1, 0].map((quantity, id) => menuItem(id, quantity)));
  assert.deepEqual(result.data.filter(({ movement }) => movement === "fast").map(({ quantitySold }) => quantitySold), [100, 90, 80]);
  assert.deepEqual(result.data.filter(({ movement }) => movement === "slow").map(({ quantitySold }) => quantitySold), [1, 2, 3]);
  assert.equal(result.items.length, 11);
  const empty = buildItemMovement([menuItem(1, 0), menuItem(2, 0)]);
  assert.equal(empty.state, "no-sales");
  assert.equal(empty.items.every(({ popularity, movement }) => popularity === 0 && movement === "non"), true);
  assert.deepEqual(empty.data, []);
});

test("report category membership supports explicit subcategories, category links to children, and active zero sellers", () => {
  const report = buildSalesReport([{ status: "Completed", created_at: "2026-10-29T04:00:00Z", order_items: [
    { menu_item_id: 1, item_name: "Item A", quantity: 9, subtotal: 90 },
    { menu_item_id: 2, item_name: "Item B", quantity: 1, subtotal: 10 },
    { menu_item_id: 4, item_name: "Archived", quantity: 1000, subtotal: 10000 },
  ] }], [
    { id: 1, name: "Item A", category_id: 1, subcategory_id: 2 },
    { id: 2, name: "Item B", category_id: 2 },
    { id: 3, name: "Item C", category_id: 1, subcategory_id: 2 },
    { id: 4, name: "Archived", category_id: 2, is_active: false },
  ], [{ id: 1, name: "Food", parent_id: null }, { id: 2, name: "Rice Meals", parent_id: 1 }]);
  const result = buildItemMovement(report.movementItems);
  assert.deepEqual(result.items.map(({ name, popularity, classification }) => [name, popularity, classification]), [
    ["Item A", 90, "Fast-moving"], ["Item B", 10, "Slow-moving"], ["Item C", 0, "Non-moving"],
  ]);
  assert.equal(result.categories.length, 1);
  assert.equal(result.categories[0].name, "Rice Meals");
  assert.equal(result.categories[0].itemCount, 3);
  assert.equal(result.categories[0].totalUnitsSold, 10);
});
