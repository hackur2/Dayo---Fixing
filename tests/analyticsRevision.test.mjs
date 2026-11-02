import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { buildSalesReport } from "../src/utils/salesReportUtils.js";
import { buildIngredientRevenue, buildSalesTrend, getDashboardShares, sharePercentage, summarizeSales } from "../src/utils/salesAnalysisUtils.js";
import { buildInventoryValuation } from "../src/utils/inventoryValuationUtils.js";
import { createIngredientPayload, normalizeIngredient } from "../src/adapters/inventoryAdapter.js";
import { getPagination } from "../src/utils/paginationUtils.js";

const sale = (date, revenue) => ({ status: "Completed", created_at: date, order_items: [{ menu_item_id: 1, item_name: "Meal", quantity: 1, subtotal: revenue }] });
const report = buildSalesReport([sale("2026-10-29T15:30:00Z", 300), sale("2026-10-29T16:30:00Z", 100), sale("2026-11-02T04:00:00Z", 200)], [], []);
const range = { startDate: "2026-10-28", endDate: "2026-11-03" };

test("hourly sales use Philippine dates and combine the same hour without losing revenue or order counts", () => {
  assert.deepEqual(report.hourlySales.map(({ date, hour }) => [date, hour]), [["2026-10-29", 23], ["2026-10-30", 0], ["2026-11-02", 12]]);
  const hours = buildSalesTrend(report, "hour", { startDate: "2026-10-30", endDate: "2026-11-02" });
  assert.equal(hours.length, 24);
  assert.equal(hours[0].totalSales, 100);
  assert.equal(hours[23].totalSales, 0);
  assert.equal(hours.reduce((sum, row) => sum + row.totalSales, 0), 300);
  assert.equal(hours.reduce((sum, row) => sum + row.totalOrders, 0), 2);
});

test("daily, Monday-week and calendar-month buckets include quiet dates and retain boundary totals", () => {
  const days = buildSalesTrend(report, "day", range);
  assert.equal(days.length, 7);
  assert.equal(days[0].totalSales, 0);
  assert.equal(days.at(-1).totalSales, 0);
  assert.deepEqual(buildSalesTrend(report, "week", range).map(({ key, totalSales }) => [key, totalSales]), [["2026-10-26", 400], ["2026-11-02", 200]]);
  assert.deepEqual(buildSalesTrend(report, "month", range).map(({ key, totalSales }) => [key, totalSales]), [["2026-10-01", 400], ["2026-11-01", 200]]);
  assert.deepEqual(buildSalesTrend(report, "day", { startDate: "2026-11-03", endDate: "2026-10-01" }), []);
});

test("sales percentages name real shares and daily averages count zero-sales calendar days", () => {
  const summary = summarizeSales(report, range);
  assert.equal(summary.totalSales, 600);
  assert.equal(summary.totalOrders, 3);
  assert.equal(summary.averageDailySales, 600 / 7);
  assert.equal(summary.highestSalesDay.key, "2026-10-29");
  assert.equal(summary.salesShare, 100);
  assert.equal(summary.peakShare, 50);
  assert.equal(summary.averageToPeak, (600 / 7) / 300 * 100);
  const selected = summarizeSales(report, { startDate: "2026-11-01", endDate: "2026-11-03" });
  assert.equal(selected.salesShare, 200 / 600 * 100);
  assert.equal(selected.ordersShare, 1 / 3 * 100);
  assert.equal(sharePercentage(0, 0), null);
  assert.equal(summarizeSales({ dailySales: [] }, {}).highestSalesDay, null);
});

test("dashboard percentages reconcile with completed revenue, order statuses and the active ingredient catalogue", () => {
  assert.deepEqual(getDashboardShares({ todaySales: 100, totalSales: 400, totalOrders: 10, ingredientCount: 8, lowStockCount: 2, orderPipeline: [{ status: "Completed", count: 6 }] }), { revenue: 25, orders: 60, lowStock: 25 });
});

test("ingredient allocation uses recipe costs and preserves all sales including incomplete and deleted recipes", () => {
  const ingredients = [{ id: 1, name: "Rice", unit_cost: 2 }, { id: 2, name: "Chicken", unit_cost: 8 }, { id: 3, name: "Unknown cost", unit_cost: null }];
  const recipes = [{ menu_item_id: 1, ingredient_id: 1, quantity: 2 }, { menu_item_id: 1, ingredient_id: 2, quantity: 2 }, { menu_item_id: 2, ingredient_id: 3, quantity: 1 }];
  const rows = buildIngredientRevenue([{ menuItemId: 1, revenue: 100 }, { menuItemId: 2, revenue: 50 }, { menuItemId: null, revenue: 25 }], ingredients, recipes);
  assert.equal(rows.find((row) => row.name === "Rice").revenue, 20);
  assert.equal(rows.find((row) => row.name === "Chicken").revenue, 80);
  assert.equal(rows.find((row) => row.name === "Unallocated").revenue, 75);
  assert.equal(rows.reduce((sum, row) => sum + row.revenue, 0), 175);
  assert.equal(buildIngredientRevenue([{ menuItemId: 999, revenue: 100 }], ingredients, recipes)[0].name, "Unallocated");
});

test("combo allocation includes component quantities and sends cycles or incomplete components to Unallocated", () => {
  const ingredients = [{ id: 1, name: "A", unit_cost: 1 }, { id: 2, name: "B", unit_cost: 1 }];
  const recipes = [{ menu_item_id: 1, ingredient_id: 1, quantity: 1 }, { menu_item_id: 2, ingredient_id: 2, quantity: 1 }];
  const combos = [{ combo_menu_item_id: 3, component_menu_item_id: 1, quantity: 3 }, { combo_menu_item_id: 3, component_menu_item_id: 2, quantity: 1 }];
  const rows = buildIngredientRevenue([{ menuItemId: 3, revenue: 100 }], ingredients, recipes, combos);
  assert.equal(rows.find((row) => row.name === "A").revenue, 75);
  assert.equal(rows.find((row) => row.name === "B").revenue, 25);
  for (const component of [3, 999]) {
    const invalid = buildIngredientRevenue([{ menuItemId: 3, revenue: 100 }], ingredients, recipes, [...combos, { combo_menu_item_id: 3, component_menu_item_id: component, quantity: 1 }]);
    assert.equal(invalid.find((row) => row.name === "Unallocated").revenue, 100);
  }
});

test("inventory value prices different stock units without treating missing costs as free stock", () => {
  const valuation = buildInventoryValuation([
    { currentStock: 2, unitCost: 100 }, { currentStock: 500, unitCost: .02 }, { currentStock: 40, unitCost: 0 },
    { currentStock: 7, unitCost: null }, { currentStock: 0, unitCost: null }, { currentStock: 10, unitCost: 50, archivedAt: "2026-10-01" },
  ]);
  assert.deepEqual(valuation, { totalValue: 210, missingCostCount: 1, pricedStockCount: 3, hasValue: true });
  assert.equal(buildInventoryValuation([{ currentStock: 7, unitCost: null }]).hasValue, false);
  assert.equal(buildInventoryValuation([]).totalValue, 0);
  assert.equal(normalizeIngredient({ id: 1 }).unitCost, null);
  assert.equal(normalizeIngredient({ id: 1, unit_cost: "0.0175" }).unitCost, .0175);
  assert.equal(createIngredientPayload({ name: "Rice", unit: "Grams", unitCost: "0", currentStock: "2", reorderLevel: "1" }).unitCost, 0);
});

test("pagination produces disjoint 15-row pages, clamps after deletions and handles no matches", () => {
  const rows = Array.from({ length: 32 }, (_, id) => id);
  const pages = [1, 2, 3].map((page) => getPagination(rows.length, page));
  assert.deepEqual(pages.map(({ start, end }) => [start, end]), [[1, 15], [16, 30], [31, 32]]);
  assert.deepEqual(pages.flatMap(({ offset, end }) => rows.slice(offset, end)), rows);
  assert.equal(getPagination(16, 3).page, 2);
  assert.equal(getPagination(0, 3).start, 0);
  assert.equal(getPagination(0, 3).end, 0);
  assert.equal(getPagination(15).pageCount, 1);
});

test("unit-cost SQL Editor setup preserves stock and costs when repeated and rejects negative costs", async () => {
  const db = new PGlite();
  try {
    await db.exec("create table public.ingredients(id bigint primary key, name text, current_stock numeric, unit text); insert into public.ingredients values(1,'Rice',20,'kg')");
    const sql = await readFile(new URL("../supabase/snippets/ingredient_unit_cost_setup.sql", import.meta.url), "utf8");
    await db.exec(sql);
    assert.equal((await db.query("select unit_cost from public.ingredients")).rows[0].unit_cost, null);
    await db.exec("update public.ingredients set unit_cost=0.0175 where id=1");
    await db.exec(sql);
    assert.deepEqual((await db.query("select current_stock,unit_cost from public.ingredients")).rows[0], { current_stock: "20", unit_cost: "0.0175" });
    await assert.rejects(db.exec("update public.ingredients set unit_cost=-1 where id=1"), /check constraint/);
  } finally { await db.close(); }
});
