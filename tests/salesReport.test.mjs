import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";
import { buildItemMovement, buildItemSalesTrend, buildSalesReport } from "../src/utils/salesReportUtils.js";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { createSalesGraphService, createSalesReportLoader } = await vite.ssrLoadModule("/src/services/salesGraphService.js");
after(() => vite.close());

test("charts share concurrent matching requests while different ranges load independently", async () => {
  const calls = [];
  const load = createSalesReportLoader({ getSalesReport: async (start, end) => { calls.push([start, end]); return { start, end }; } });
  const first = load("", "");
  const same = load("", "");
  const filtered = load("2026-10-01", "2026-10-10");
  assert.equal(first, same);
  assert.notEqual(first, filtered);
  const [allResult, filteredResult] = await Promise.all([first, filtered]);
  assert.deepEqual(allResult, { start: "", end: "" });
  assert.deepEqual(filteredResult, { start: "2026-10-01", end: "2026-10-10" });
  assert.equal(calls.length, 2);
  await load("", "");
  assert.equal(calls.length, 3);
});

test("failed requests can retry and separate page loaders never share cached reports", async () => {
  let calls = 0;
  const service = { getSalesReport: async () => { calls += 1; if (calls === 1) throw new Error("Load failed"); return {}; } };
  const firstPage = createSalesReportLoader(service);
  await assert.rejects(firstPage("", ""), /Load failed/);
  await firstPage("", "");
  const secondPage = createSalesReportLoader(service);
  await Promise.all([firstPage("", ""), secondPage("", "")]);
  assert.equal(calls, 4);
});

const categories = [{ id: 1, name: "Food", parent_id: null }, { id: 2, name: "Drinks", parent_id: null }, { id: 3, name: "Rice Meals", parent_id: 1 }];
const menu = [{ id: 11, category_id: 1, subcategory_id: 3 }, { id: 12, category_id: 2 }, { id: 13, category_id: 3 }];
const item = (id, name, quantity, subtotal) => ({ menu_item_id: id, item_name: name, quantity, subtotal });
const order = (date, items, status = "Completed") => ({ created_at: date, order_items: items, status });

test("category revenue reconciles with daily totals, rolls subcategories into parents and preserves archived sales", () => {
  const report = buildSalesReport([
    order("2026-10-26T17:00:00Z", [item(11, "Adobo", "2", "240.50"), item(12, "Coffee", 1, 80)]),
    order("2026-10-27T04:00:00Z", [item(13, "Rice", 3, 90), item(null, "Archived Meal", 1, 70)]),
    order("2026-10-27T05:00:00Z", [item(11, "Adobo", 100, 12000)], "Cancelled"),
  ], menu, categories);
  assert.equal(report.dailySales.length, 1);
  assert.equal(report.dailySales[0].date, "2026-10-27");
  assert.equal(report.dailySales[0].totalOrders, 2);
  assert.equal(report.dailySales[0].totalSales, 480.5);
  assert.deepEqual(report.categories.map(({ name, revenue }) => [name, revenue]), [["Drinks", 80], ["Food", 330.5], ["Uncategorized", 70]]);
  assert.equal(report.categories.reduce((total, category) => total + category.revenue, 0), report.dailySales[0].totalSales);
  assert.equal(report.items[0].name, "Rice");
});

test("variants combine into one menu item and the stacked series retains all units in Other items", () => {
  const report = buildSalesReport([order("2026-10-27T04:00:00Z", [
    item(1, "Coffee", 2, 160), item(1, "Coffee", 3, 240), item(2, "Rice", 4, 80),
    item(3, "Tea", 3, 120), item(4, "Juice", 2, 100),
  ])], [], []);
  assert.equal(report.items[0].quantitySold, 5);
  assert.equal(report.items[0].revenue, 400);
  const trend = buildItemSalesTrend(report.dailySales, report.items);
  assert.deepEqual(trend.series.map(({ name }) => name), ["Coffee", "Rice", "Tea", "Other items"]);
  assert.deepEqual(trend.data[0], { date: "2026-10-27", item0: 5, item1: 4, item2: 3, other: 2 });
});

test("movement includes active zero-sales items and excludes archived items without losing their revenue", () => {
  const report = buildSalesReport([order("2026-10-27T04:00:00Z", [item(1, "Adobo", 2, 200), item(2, "Old Meal", 9, 900)])], [
    { id: 1, name: "Adobo", is_active: true }, { id: 2, name: "Old Meal", is_active: false }, { id: 3, name: "New Tea", is_active: true },
  ], []);
  assert.deepEqual(report.movementItems.map(({ name, quantitySold }) => [name, quantitySold]), [["Adobo", 2], ["New Tea", 0]]);
  assert.equal(report.dailySales[0].totalSales, 1100);
  assert.equal(report.items.length, 2);
});

test("movement previews show only the top three fast and slow sellers and exclude non-moving items", () => {
  const items = [100, 90, 80, 70, 60, 50, 40, 30, 20, 0].map((quantitySold, id) => ({ id, name: `Item ${id}`, quantitySold }));
  const { data, state, items: classified } = buildItemMovement(items);
  assert.equal(state, "ranked");
  assert.deepEqual(data.filter(({ movement }) => movement === "fast").map(({ quantitySold }) => quantitySold), [100, 90, 80]);
  assert.deepEqual(data.filter(({ movement }) => movement === "slow").map(({ quantitySold }) => quantitySold), [20, 30]);
  assert.equal(classified.length, 10);
  assert.equal(classified.find(({ quantitySold }) => quantitySold === 0).movement, "non");
  assert.equal(new Set(data.map(({ id }) => id)).size, data.length);
  assert.deepEqual(items.map(({ quantitySold }) => quantitySold), [100, 90, 80, 70, 60, 50, 40, 30, 20, 0]);
});

test("equal positive sales are fast-moving and zero-sales items are non-moving", () => {
  const equalItems = [1, 2, 3].map((id) => ({ id, name: `Item ${id}`, quantitySold: 5 }));
  assert.equal(buildItemMovement(equalItems).state, "ranked");
  assert.equal(buildItemMovement(equalItems).items.every(({ movement }) => movement === "fast"), true);
  const zeroItems = equalItems.map((row) => ({ ...row, quantitySold: 0 }));
  assert.equal(buildItemMovement(zeroItems).state, "no-sales");
  assert.equal(buildItemMovement(zeroItems).items.every(({ movement, popularity }) => movement === "non" && popularity === 0), true);
  assert.deepEqual(buildItemMovement(zeroItems).data, []);
  assert.deepEqual(buildItemMovement([]), { data: [], items: [], categories: [], state: "empty" });
});

test("ties in sales quantities receive the same popularity classification", () => {
  for (const quantities of [[10, 0, 0, 0], [10, 10, 10, 0], [10, 5, 5, 5, 1]]) {
    const { data } = buildItemMovement(quantities.map((quantitySold, id) => ({ id, name: `Item ${id}`, quantitySold })));
    const fastCounts = new Set(data.filter(({ movement }) => movement === "fast").map(({ quantitySold }) => quantitySold));
    assert.equal(data.some(({ movement }) => movement === "fast"), true);
    assert.equal(data.every(({ quantitySold }) => quantitySold > 0), true);
    assert.equal(data.filter(({ movement }) => movement === "slow").some(({ quantitySold }) => fastCounts.has(quantitySold)), false);
  }
});

test("empty data stays empty and cyclic or missing categories cannot lose recorded revenue", () => {
  const empty = buildSalesReport([], [], []);
  assert.deepEqual(empty, { dailySales: [], categories: [], subCategories: [], items: [], movementItems: [], hourlySales: [], ingredients: [] });
  const report = buildSalesReport([order("2026-10-27T04:00:00Z", [item(11, "Meal", 1, 100)])], menu,
    [{ id: 1, name: "Loop A", parent_id: 3 }, { id: 3, name: "Loop B", parent_id: 1 }]);
  assert.equal(report.categories[0].name, "Uncategorized");
  assert.equal(report.categories[0].revenue, 100);
});

function mockApi(errorTable, overrides = {}, failOffset = 0) {
  const requests = [];
  const tables = { orders: [order("2026-10-27T04:00:00Z", [item(11, "Adobo", 2, 240)])], menu_items: menu, menu_categories: categories, ingredients: [], menu_item_ingredients: [], combo_components: [], ...overrides };
  const client = createClient("https://sales-report-test.supabase.co", "test-only-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url) => {
      const request = new URL(url);
      requests.push(request);
      const table = request.pathname.split("/").at(-1);
      const offset = Number(request.searchParams.get("offset") || 0);
      const limit = Number(request.searchParams.get("limit") || 1000);
      const failed = table === errorTable && offset >= failOffset;
      return new Response(JSON.stringify(failed ? { message: "Report data unavailable" } : (tables[table] ?? []).slice(offset, offset + limit)), {
        status: failed ? 403 : 200, headers: { "Content-Type": "application/json" },
      });
    } },
  });
  return { service: createSalesGraphService(client), requests };
}

test("the report fetches completed sales and menu metadata with inclusive Philippine date bounds", async () => {
  const { service, requests } = mockApi();
  const report = await service.getSalesReport("2026-10-27", "2026-10-27");
  const ordersRequest = requests.find((url) => url.pathname.endsWith("orders"));
  assert.equal(ordersRequest.searchParams.get("status"), "eq.Completed");
  assert.equal(ordersRequest.searchParams.get("created_at"), "gte.2026-10-27T00:00:00+08:00");
  assert.deepEqual(ordersRequest.searchParams.getAll("created_at"), ["gte.2026-10-27T00:00:00+08:00", "lt.2026-10-28T00:00:00+08:00"]);
  assert.equal(requests.length, 6);
  const menuRequest = requests.find((url) => url.pathname.endsWith("menu_items"));
  assert.equal(menuRequest.searchParams.get("select").includes("name,is_active"), true);
  assert.equal(report.dailySales[0].totalSales, 240);
});

test("report errors are surfaced for every source and the existing daily-sales service stays available", async () => {
  for (const table of ["orders", "menu_items", "menu_categories", "ingredients", "menu_item_ingredients", "combo_components"]) {
    await assert.rejects(mockApi(table).service.getSalesReport(), { message: "Report data unavailable" });
  }
  assert.equal((await mockApi().service.getSalesGraph())[0].totalSales, 240);
  await assert.rejects(createSalesGraphService(null).getSalesReport(), /Supabase is not configured/);
});

test("sales reports include orders and metadata after the first API page and reject incomplete later pages", async () => {
  const orders = Array.from({ length: 1015 }, (_, id) => ({ id, ...order("2026-10-27T04:00:00Z", [item(11, "Meal", 1, 10)]) }));
  const ingredients = Array.from({ length: 1001 }, (_, id) => ({ id, name: `Ingredient ${id}`, unit_cost: 1 }));
  const report = await mockApi(undefined, { orders, ingredients, menu_item_ingredients: [{ menu_item_id: 11, ingredient_id: 1000, quantity: 1 }] }).service.getSalesReport();
  assert.equal(report.dailySales[0].totalOrders, 1015);
  assert.equal(report.dailySales[0].totalSales, 10150);
  assert.equal(report.ingredients.find((row) => row.id === "ingredient:1000").revenue, 10150);
  await assert.rejects(mockApi("orders", { orders }, 1000).service.getSalesReport(), { message: "Report data unavailable" });
});
