import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSalesGraphData } from "../src/adapters/salesGraphAdapter.js";
import { buildSalesReport } from "../src/utils/salesReportUtils.js";
import { buildSalesTrend, buildSalesTrendSeries, getSalesTrendEntities, summarizeSales } from "../src/utils/salesAnalysisUtils.js";

const item = (id, name, subtotal) => ({ menu_item_id: id, item_name: name, quantity: 1, subtotal });
const order = (created_at, order_items, status = "Completed") => ({ created_at, order_items, status });
const report = buildSalesReport([
  order("2026-10-31T15:30:00Z", [item(1, "Coffee", 80), item(1, "Coffee", 120), item(2, "Rice", 50)]),
  order("2026-10-31T16:30:00Z", [item(2, "Rice", 60), item(null, "Old Meal", 70)]),
  order("2026-11-02T15:30:00Z", [item(1, "Coffee", 90)]),
  order("2026-11-02T15:30:00Z", [item(1, "Coffee", 999)], "Cancelled"),
], [
  { id: 1, name: "Coffee", category_id: 3 },
  { id: 2, name: "Rice", category_id: 2 },
  { id: 4, name: "Tea", category_id: 1 },
], [
  { id: 1, name: "Drinks", parent_id: null },
  { id: 2, name: "Food", parent_id: null },
  { id: 3, name: "Coffee Drinks", parent_id: 1 },
]);
const range = { startDate: "2026-10-31", endDate: "2026-11-03" };
const sum = (rows) => rows.reduce((total, row) => total + row.totalSales, 0);

test("individual menu sales combine variants, exclude other items and keep quiet days", () => {
  const trend = buildSalesTrend(report, "day", range, "menu:1");
  assert.deepEqual(trend.map(({ totalSales }) => totalSales), [200, 0, 90, 0]);
  assert.equal(sum(buildSalesTrend(report, "day", range, "menu:2")), 110);
  assert.equal(sum(buildSalesTrend(report, "day", range, "menu:4")), 0);
  assert.equal(sum(buildSalesTrend(report, "day", range, "archived:Old Meal")), 70);
});

test("entity selection respects Philippine hours, date bounds, Monday weeks and month boundaries", () => {
  const hours = buildSalesTrend(report, "hour", range, "menu:1");
  assert.equal(hours.length, 24);
  assert.equal(hours[23].totalSales, 290);
  assert.equal(hours[0].totalSales, 0);
  assert.deepEqual(buildSalesTrend(report, "week", range, "menu:1").map(({ totalSales }) => totalSales), [200, 90]);
  assert.deepEqual(buildSalesTrend(report, "month", range, "menu:1").map(({ totalSales }) => totalSales), [200, 90]);
  assert.equal(sum(buildSalesTrend(report, "hour", { startDate: "2026-11-01", endDate: "2026-11-02" }, "menu:2")), 60);
});

test("category trends roll up subcategories and reconcile with recorded category revenue at every interval", () => {
  for (const interval of ["hour", "day", "week", "month"]) {
    for (const category of [...report.categories, ...report.subCategories]) {
      assert.equal(sum(buildSalesTrend(report, interval, range, category.id)), category.revenue);
    }
    assert.equal(sum(buildSalesTrend(report, interval, range)), 470);
  }
});

test("subcategories isolate sibling sales and support both menu category representations", () => {
  const report = buildSalesReport([
    order("2026-10-31T15:30:00Z", [item(1, "Latte", 100), item(2, "Tea", 200), item(3, "Water", 50)]),
  ], [
    { id: 1, category_id: 1, subcategory_id: 3 },
    { id: 2, category_id: 4 },
    { id: 3, category_id: 1 },
  ], [
    { id: 1, name: "Drinks", parent_id: null },
    { id: 3, name: "Coffee", parent_id: 1 },
    { id: 4, name: "Tea", parent_id: 1 },
    { id: 5, name: "Juice", parent_id: 1 },
  ]);
  assert.deepEqual(report.subCategories.map(({ name, revenue }) => [name, revenue]), [["Coffee", 100], ["Juice", 0], ["Tea", 200]]);
  for (const interval of ["hour", "day", "week", "month"]) {
    assert.equal(sum(buildSalesTrend(report, interval, range, "category:1")), 350);
    assert.equal(sum(buildSalesTrend(report, interval, range, "subcategory:3")), 100);
    assert.equal(sum(buildSalesTrend(report, interval, range, "subcategory:4")), 200);
    assert.equal(sum(buildSalesTrend(report, interval, range, "subcategory:5")), 0);
    assert.equal(sum(buildSalesTrend(report, interval, range)), 350);
  }
});

test("normalization retains entity revenue and selecting a trend leaves the overall summary unchanged", () => {
  const normalized = { ...report, dailySales: normalizeSalesGraphData(report.dailySales) };
  const original = structuredClone(normalized);
  const summary = summarizeSales(normalized, range);
  assert.equal(sum(buildSalesTrend(normalized, "day", range, "menu:1")), 290);
  assert.equal(summary.totalSales, 470);
  assert.equal(summary.totalOrders, 3);
  assert.deepEqual(summarizeSales(normalized, range), summary);
  assert.deepEqual(normalized, original);
});

test("main chart entities are only Food and Drink and aggregate the existing menu groups", () => {
  const report = buildSalesReport([
    order("2026-10-31T15:30:00Z", [item(1, "Meal", 100), item(2, "Noodles", 200), item(3, "Tea", 50)]),
  ], [
    { id: 1, category_id: 1 }, { id: 2, category_id: 2 }, { id: 3, category_id: 3, subcategory_id: 4 },
  ], [
    { id: 1, name: "Student Meals", parent_id: null },
    { id: 2, name: "Fried Noodles", parent_id: null },
    { id: 3, name: " Drinks ", parent_id: null },
    { id: 4, name: "Tea", parent_id: 3 },
  ]);
  const { mainCategories, subCategories } = getSalesTrendEntities(report);
  assert.deepEqual(mainCategories.map(({ name }) => name), ["Food", "Drink"]);
  assert.deepEqual(subCategories.map(({ name }) => name), ["Fried Noodles", "Student Meals", "Tea"]);
  for (const interval of ["hour", "day", "week", "month"]) {
    assert.equal(sum(buildSalesTrend(report, interval, range, mainCategories[0].categoryIds)), 300);
    assert.equal(sum(buildSalesTrend(report, interval, range, mainCategories[1].categoryIds)), 50);
    assert.equal(sum(buildSalesTrend(report, interval, range)), 350);
  }
});

test("Food and Drink remain the only main entities for empty or uncategorized records", () => {
  const { mainCategories, subCategories } = getSalesTrendEntities({ categories: [{ id: "uncategorized", name: "Uncategorized" }] });
  assert.deepEqual(mainCategories.map(({ name }) => name), ["Food", "Drink"]);
  assert.deepEqual(subCategories, []);
  assert.equal(sum(buildSalesTrend(report, "day", range, mainCategories[0].categoryIds)), 0);
  assert.equal(sum(buildSalesTrend(report, "day", range, mainCategories[1].categoryIds)), 0);
});

test("ALL ITEMS plots every menu item as its own series, including zero-sales and archived items", () => {
  const { data, series } = buildSalesTrendSeries(report, "day", range, "items");
  assert.deepEqual(series.map(({ name }) => name), ["Coffee", "Old Meal", "Rice", "Tea"]);
  const coffee = series.find(({ id }) => id === "menu:1");
  const tea = series.find(({ id }) => id === "menu:4");
  assert.deepEqual(data.map((row) => row[coffee.key]), [200, 0, 90, 0]);
  assert.equal(data.every((row) => row[tea.key] === 0), true);
  assert.equal(data.reduce((total, row) => total + series.reduce((sum, entity) => sum + row[entity.key], 0), 0), 470);
  const manyItems = { ...report, movementItems: Array.from({ length: 20 }, (_, index) => ({ id: `menu:${index + 100}`, name: `Item ${index}` })) };
  assert.equal(buildSalesTrendSeries(manyItems, "day", range, "items").series.length, 23);
});

test("MAIN CATEGORY plots Food and Drink together and SUBCATEGORY plots the subcategory entities", () => {
  for (const interval of ["hour", "day", "week", "month"]) {
    const main = buildSalesTrendSeries(report, interval, range, "main");
    assert.deepEqual(main.series.map(({ name }) => name), ["Food", "Drink"]);
    assert.equal(main.data.reduce((sum, row) => sum + row[main.series[0].key], 0), 110);
    assert.equal(main.data.reduce((sum, row) => sum + row[main.series[1].key], 0), 290);
    const sub = buildSalesTrendSeries(report, interval, range, "subcategory");
    assert.deepEqual(sub.series.map(({ name }) => name), ["Coffee Drinks"]);
    assert.equal(sub.data.reduce((sum, row) => sum + row[sub.series[0].key], 0), 290);
  }
});

test("changing chart groups preserves date filtering, quiet dates and the original report", () => {
  const original = structuredClone(report);
  const range = { startDate: "2026-11-01", endDate: "2026-11-03" };
  for (const mode of ["items", "main", "subcategory"]) {
    const { data, series } = buildSalesTrendSeries(report, "day", range, mode);
    assert.deepEqual(data.map(({ key }) => key), ["2026-11-01", "2026-11-02", "2026-11-03"]);
    assert.equal(data.reduce((total, row) => total + series.reduce((sum, entity) => sum + row[entity.key], 0), 0), mode === "items" ? 220 : mode === "main" ? 150 : 90);
    assert.equal(series.every((entity) => data[2][entity.key] === 0), true);
  }
  assert.deepEqual(report, original);
  assert.deepEqual(buildSalesTrendSeries({}, "day", {}, "items"), { data: [], series: [] });
});
