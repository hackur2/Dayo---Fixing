import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { createDashboardService } = await vite.ssrLoadModule("/src/services/dashboardService.js");
const { normalizeDashboardSummary } = await vite.ssrLoadModule("/src/adapters/dashboardAdapter.js");
const { getDashboardDate, getDailyIncomeProgress, buildRevenueTimeline, getRevenueDateRange, buildCustomerActivity, buildShelfLifeSummary } = await vite.ssrLoadModule("/src/utils/dashboardUtils.js");
after(() => vite.close());

function mockApi({ orders = [], ingredients = [], menuItems = [], stockMovements = [], staff = 0, errorTable } = {}) {
  const requests = [];
  const client = createClient("https://dashboard-test.supabase.co", "test-only-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (url, init) => {
        const request = { url: new URL(url), method: init.method };
        requests.push(request);
        const table = request.url.pathname.split("/").at(-1);
        if (table === errorTable) {
          return new Response(JSON.stringify({ message: "Database unavailable" }), { status: 403 });
        }
        if (init.method === "HEAD") {
          return new Response(null, { headers: { "Content-Range": `*/${staff}` } });
        }
        const offset = Number(request.url.searchParams.get("offset") || 0);
        const records = { orders, ingredients, menu_items: menuItems, stock_movements: stockMovements }[table] ?? [];
        const limit = Number(request.url.searchParams.get("limit") || records.length);
        return new Response(JSON.stringify(records.slice(offset, offset + limit)), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  return { service: createDashboardService(client), requests };
}

const item = (menuId, name, quantity, subtotal) => ({
  menu_item_id: menuId, item_name: name, quantity, subtotal,
});

test("totals reconcile with all-date Order Summary, Inventory and on-duty shifts", async () => {
  const { service, requests } = mockApi({
    orders: [
      { status: "Completed", created_at: "2025-01-01", order_items: [item(1, "Adobo", "2", "240.50")] },
      { status: "Completed", created_at: "2026-10-27", order_items: [item(1, "Adobo", 3, 360), item(2, "Rice", 5, 100)] },
      { status: "Pending", order_items: [item(2, "Rice", 20, 400)] },
      { status: "Preparing", order_items: [] },
      { status: "Ready", order_items: [] },
      { status: "Cancelled", order_items: [item(1, "Adobo", 50, 6000)] },
    ],
    ingredients: [
      { id: 1, current_stock: "5", reorder_level: "5" },
      { id: 2, current_stock: 2, reorder_level: 5 },
      { id: 3, current_stock: 0, reorder_level: 5 },
      { id: 4, current_stock: -1, reorder_level: 5 },
      { id: 5, current_stock: 10, reorder_level: 5 },
    ],
    stockMovements: [1, 2].map((id) => ({ id, ingredient_id: id, adjustment: -75, reason: "Order DY-001 completed", created_at: "2026-10-26T04:00:00Z" })),
    staff: 4,
  });
  const summary = normalizeDashboardSummary(await service.getDashboardSummary(new Date("2026-10-27T04:00:00Z")));
  assert.equal(summary.totalSales, 700.5);
  assert.equal(summary.todaySales, 460);
  assert.equal(summary.totalOrders, 6);
  assert.equal(summary.lowStockCount, 2);
  assert.equal(requests.some(({ url }) => url.pathname.endsWith("feedback")), false);
  assert.equal(summary.activeStaffCount, 4);
  assert.deepEqual(summary.orderPipeline.map(({ count }) => count), [1, 1, 1, 2, 1]);
  assert.equal(summary.topSellingItems[0].name, "Adobo");
  assert.equal(summary.topSellingItems[0].quantitySold, 5);
  assert.equal(summary.topSellingItems[0].revenue, 600.5);
  assert.equal(summary.topSellingItems[1].quantitySold, 5);
  assert.equal(requests.find(({ url }) => url.pathname.endsWith("staff_shifts")).url.searchParams.get("status"), "eq.On Duty");
  assert.equal(requests.find(({ url }) => url.pathname.endsWith("orders")).url.searchParams.has("created_at"), false);
});

test("empty tables yield zero totals, an empty menu, and all pipeline statuses", async () => {
  const { service } = mockApi();
  const summary = normalizeDashboardSummary(await service.getDashboardSummary());
  for (const key of ["totalSales", "todaySales", "totalOrders", "lowStockCount", "feedbackCount", "activeStaffCount"]) {
    assert.equal(summary[key], 0);
  }
  assert.deepEqual(summary.topSellingItems, []);
  assert.equal(summary.orderPipeline.length, 5);
  assert.equal(summary.orderPipeline.every(({ count }) => count === 0), true);
  assert.deepEqual(summary.orderSources.map(({ count }) => count), [0, 0, 0]);
  assert.deepEqual(summary.shelfLife, { freshCount: 0, expiringSoonCount: 0, expiredCount: 0, undatedCount: 0, nearExpiry: [] });
});

test("order sources count each order once and use the same AI classification as Order Summary", async () => {
  const aiItem = { ...item(1, "Adobo", 1, 100), recommendation_source: "Sumo AI" };
  const { service } = mockApi({ orders: [
    { source: "QR Order", order_items: [] },
    { source: "Manual POS", order_items: [] },
    { source: "QR Order", order_items: [aiItem, aiItem] },
    { source: "Manual POS", order_items: [aiItem] },
    { source: "Sumo AI", order_items: [] },
    { order_items: [] },
  ] });
  const summary = await service.getDashboardSummary();
  assert.deepEqual(summary.orderSources, [
    { source: "QR Order", count: 2 },
    { source: "Manual POS", count: 1 },
    { source: "Sumo AI", count: 3 },
  ]);
  assert.equal(summary.orderSources.reduce((sum, source) => sum + source.count, 0), summary.totalOrders);
});

test("daily income uses Philippine midnight boundaries and only completed orders", async () => {
  const order = (status, created_at, subtotal) => ({ status, created_at, order_items: [item(1, "Meal", 1, subtotal)] });
  const { service } = mockApi({ orders: [
    order("Completed", "2026-10-26T15:59:59Z", 100),
    order("Completed", "2026-10-26T16:00:00Z", 200),
    order("Completed", "2026-10-27T15:59:59Z", 300),
    order("Completed", "2026-10-27T16:00:00Z", 400),
    order("Completed", undefined, 50),
    order("Pending", "2026-10-27T00:00:00Z", 600),
    order("Cancelled", "2026-10-27T00:00:00Z", 700),
  ] });
  const summary = await service.getDashboardSummary(new Date("2026-10-26T16:30:00Z"));
  assert.equal(summary.todaySales, 500);
  assert.equal(summary.totalSales, 1050);
  assert.equal(getDashboardDate("2026-10-26T16:30:00Z"), "2026-10-27");
  assert.equal(getDashboardDate(undefined), "");
});

test("daily target progress handles zero revenue, exact goals and exceeded goals", () => {
  assert.equal(getDailyIncomeProgress(500, 2000), 25);
  assert.equal(getDailyIncomeProgress(2000, 2000), 100);
  assert.equal(getDailyIncomeProgress(2500, 2000), 125);
  assert.equal(getDailyIncomeProgress(0, 2000), 0);
  assert.equal(getDailyIncomeProgress(500, 0), 0);
});

test("menu ranking combines variants, preserves deleted item names, and limits to five", async () => {
  const { service } = mockApi({ orders: [{ status: "Completed", order_items: [
    item(1, "Chicken", 8, 800), item(1, "Chicken", 4, 400),
    item(null, "Archived Beef", 10, 1000), item(null, "Archived Fish", 9, 900),
    item(4, "Rice", 7, 140), item(5, "Tea", 6, 180), item(6, "Coffee", 1, 80),
  ] }] });
  const summary = await service.getDashboardSummary();
  assert.deepEqual(summary.topSellingItems.map(({ name, quantitySold }) => [name, quantitySold]), [
    ["Chicken", 12], ["Archived Beef", 10], ["Archived Fish", 9], ["Rice", 7], ["Tea", 6],
  ]);
});

test("database errors reach the dashboard error state instead of showing false zero totals", async () => {
  for (const errorTable of ["orders", "ingredients", "stock_movements", "staff_shifts"]) {
    const { service } = mockApi({ errorTable });
    await assert.rejects(service.getDashboardSummary(), { message: "Database unavailable" });
  }
});

test("dashboard charts aggregate completed revenue and non-cancelled activity by Philippine date", async () => {
  const { service } = mockApi({ orders: [
    { status: "Completed", created_at: "2026-10-26T16:00:00Z", order_items: [item(1, "Meal", 2, 200)] },
    { status: "Completed", created_at: "2026-10-27T05:00:00Z", order_items: [item(1, "Meal", 1, 100)] },
    { status: "Pending", created_at: "2026-10-27T05:00:00Z", order_items: [item(1, "Meal", 1, 500)] },
    { status: "Cancelled", created_at: "2026-10-27T05:00:00Z", order_items: [item(1, "Meal", 1, 900)] },
    { status: "Completed", created_at: "2025-10-10T05:00:00Z", order_items: [item(1, "Meal", 1, 50)] },
  ] });
  const summary = normalizeDashboardSummary(await service.getDashboardSummary(new Date("2026-10-27T05:00:00Z")));
  assert.equal(summary.asOfDate, "2026-10-27");
  assert.deepEqual(summary.revenueTrend.map(({ date, totalSales, totalOrders }) => ({ date, totalSales, totalOrders })), [
    { date: "2025-10-10", totalSales: 50, totalOrders: 1 },
    { date: "2026-10-27", totalSales: 300, totalOrders: 2 },
  ]);
  assert.deepEqual(summary.customerActivity, [{ date: "2025-10-10", count: 1 }, { date: "2026-10-27", count: 3 }]);
  assert.equal(summary.revenueTrend.reduce((sum, day) => sum + day.totalSales, 0), summary.totalSales);
});

test("revenue presets cross year boundaries and all dates includes any historical year", () => {
  assert.deepEqual(getRevenueDateRange([], "2026-01-02", "last7"), { startDate: "2025-12-27", endDate: "2026-01-02" });
  assert.deepEqual(getRevenueDateRange([], "2026-01-02", "last30"), { startDate: "2025-12-04", endDate: "2026-01-02" });
  assert.deepEqual(getRevenueDateRange([], "2026-10-27", "month"), { startDate: "2026-10-01", endDate: "2026-10-27" });
  assert.deepEqual(getRevenueDateRange([], "2026-10-27", "year"), { startDate: "2026-01-01", endDate: "2026-10-27" });
  assert.deepEqual(getRevenueDateRange([{ date: "2023-12-10" }, { date: "2024-01-01" }, { date: "2027-01-01" }], "2026-10-27", "all"), { startDate: "2023-12-10", endDate: "2026-10-27" });
  assert.deepEqual(getRevenueDateRange([], "2026-10-27", "all"), { startDate: "2026-10-27", endDate: "2026-10-27" });
});

test("daily revenue includes both endpoints, quiet days, and an equal-length previous period", () => {
  const result = buildRevenueTimeline([
    { date: "2024-02-27", totalSales: 100, totalOrders: 1 },
    { date: "2024-02-28", totalSales: 50, totalOrders: 1 },
    { date: "2024-02-29", totalSales: 200, totalOrders: 2 },
    { date: "2024-03-02", totalSales: 300, totalOrders: 3 },
    { date: "2024-03-03", totalSales: 999, totalOrders: 9 },
  ], "2024-02-29", "2024-03-02");
  assert.equal(result.granularity, "daily");
  assert.equal(result.data.length, 3);
  assert.equal(result.previousStartDate, "2024-02-26");
  assert.equal(result.previousEndDate, "2024-02-28");
  assert.deepEqual(result.data.map((row) => [row.totalSales, row.previousSales]), [[200, 0], [0, 100], [300, 50]]);
  assert.equal(result.totalSales, 500);
  assert.equal(result.totalOrders, 5);
  assert.equal(result.previousSales, 150);
});

test("weekly revenue clips the final bucket and preserves selected totals", () => {
  const result = buildRevenueTimeline([
    { date: "2025-12-25", totalSales: 10 }, { date: "2026-01-01", totalSales: 20 },
    { date: "2026-01-28", totalSales: 30 }, { date: "2026-01-29", totalSales: 999 },
  ], "2025-12-25", "2026-01-28");
  assert.equal(result.granularity, "weekly");
  assert.equal(result.data.length, 5);
  assert.equal(result.data.at(-1).endDate, "2026-01-28");
  assert.deepEqual(result.data.map((row) => row.totalSales), [10, 20, 0, 0, 30]);
  assert.equal(result.totalSales, 60);
});

test("long revenue ranges use calendar months across years and align comparison by elapsed days", () => {
  const result = buildRevenueTimeline([
    { date: "2023-12-15", totalSales: 80 }, { date: "2024-01-01", totalSales: 100 },
    { date: "2024-07-10", totalSales: 120 }, { date: "2024-07-11", totalSales: 999 },
    { date: "2023-05-20", totalSales: 40 },
  ], "2023-12-15", "2024-07-10");
  assert.equal(result.granularity, "monthly");
  assert.equal(result.data.length, 8);
  assert.equal(result.data[0].startDate, "2023-12-15");
  assert.equal(result.data[0].endDate, "2023-12-31");
  assert.equal(result.data.at(-1).endDate, "2024-07-10");
  assert.match(result.data[0].label, /2023/);
  assert.match(result.data[1].label, /2024/);
  assert.equal(result.totalSales, 300);
  assert.equal(result.previousSales, 40);
  for (const row of result.data) {
    assert.equal(Date.parse(row.endDate) - Date.parse(row.startDate), Date.parse(row.previousEndDate) - Date.parse(row.previousStartDate));
  }
});

test("revenue supports a single day, empty ranges, and rejects reversed or missing dates", () => {
  const day = buildRevenueTimeline([{ date: "2022-01-01", totalSales: 50 }], "2022-01-01", "2022-01-01");
  assert.equal(day.data.length, 1);
  assert.equal(day.totalSales, 50);
  assert.equal(day.previousStartDate, "2021-12-31");
  assert.equal(buildRevenueTimeline([], "2022-01-01", "2022-01-07").totalSales, 0);
  assert.deepEqual(buildRevenueTimeline([], "2026-01-02", "2026-01-01").data, []);
  assert.deepEqual(buildRevenueTimeline([], "", "").data, []);
});

test("revenue and dashboard totals include order history beyond the first database page", async () => {
  const orders = Array.from({ length: 1001 }, (_, index) => ({
    id: index + 1, status: "Completed", created_at: index < 1000 ? "2022-01-01" : "2026-10-27",
    order_items: [item(1, "Meal", 1, 10)],
  }));
  const { service, requests } = mockApi({ orders });
  const summary = await service.getDashboardSummary(new Date("2026-10-27T05:00:00Z"));
  assert.equal(summary.totalOrders, 1001);
  assert.equal(summary.totalSales, 10010);
  assert.equal(summary.todaySales, 10);
  assert.equal(summary.revenueTrend[0].totalSales, 10000);
  assert.equal(summary.revenueTrend[1].totalSales, 10);
  const orderRequests = requests.filter(({ url }) => url.pathname.endsWith("orders"));
  assert.equal(orderRequests.length, 2);
  assert.equal(orderRequests[1].url.searchParams.get("offset"), "1000");
  assert.equal(orderRequests[1].url.searchParams.get("order"), "id.asc");
});

test("customer map fills quiet days and switches between a rolling week and month to date", () => {
  const activity = [{ date: "2025-12-31", count: 3 }, { date: "2026-01-02", count: 5 }, { date: "2026-01-03", count: 99 }];
  const week = buildCustomerActivity(activity, "weekly", "2026-01-02");
  assert.equal(week.length, 7);
  assert.equal(week[0].date, "2025-12-27");
  assert.deepEqual(week.map((row) => row.count), [0, 0, 0, 0, 3, 0, 5]);
  assert.deepEqual(buildCustomerActivity(activity, "monthly", "2026-01-02"), [
    { date: "2026-01-01", label: "1", count: 0 }, { date: "2026-01-02", label: "2", count: 5 },
  ]);
  assert.deepEqual(buildCustomerActivity([], "weekly", ""), []);
});

test("shelf life classifies in-stock ingredients and lists the three closest unexpired dates", () => {
  const ingredient = (id, name, expiresOn, currentStock = 10) => ({ id, name, expiresOn, currentStock });
  const summary = buildShelfLifeSummary([
    ingredient(1, "Rice", "2026-11-12"),
    ingredient(2, "Eggs", "2026-10-28"),
    ingredient(3, "Milk", "2026-10-29"),
    ingredient(4, "Chicken", "2026-11-01"),
    ingredient(5, "Fish", "2026-11-11"),
    ingredient(6, "Beef", "2026-10-27"),
    ingredient(7, "Empty expired stock", "2026-10-27", 0),
    ingredient(8, "Empty near-expiry stock", "2026-11-01", -1),
    ingredient(9, "Salt", ""),
    ingredient(10, "Invalid date", "2026-02-30"),
  ], "2026-10-28");
  assert.equal(summary.freshCount, 1);
  assert.equal(summary.expiringSoonCount, 4);
  assert.equal(summary.expiredCount, 1);
  assert.equal(summary.undatedCount, 2);
  assert.deepEqual(summary.nearExpiry, [
    { id: 2, name: "Eggs", expiresOn: "2026-10-28", daysUntilExpiry: 0 },
    { id: 3, name: "Milk", expiresOn: "2026-10-29", daysUntilExpiry: 1 },
    { id: 4, name: "Chicken", expiresOn: "2026-11-01", daysUntilExpiry: 4 },
  ]);
});

test("shelf monitoring uses inventory expiry fields and the Philippine calendar date", async () => {
  const { service, requests } = mockApi({ ingredients: [
    { id: 1, name: "Milk", current_stock: 0, archived_at: "2026-10-27T00:00:00Z", reorder_level: 5, expires_on: "2026-10-27" },
    { id: 2, name: "Eggs", current_stock: 3, expires_on: "2026-10-29" },
  ] });
  const summary = normalizeDashboardSummary(await service.getDashboardSummary(new Date("2026-10-27T16:00:00Z")));
  assert.equal(summary.asOfDate, "2026-10-28");
  assert.equal(summary.shelfLife.expiredCount, 0);
  assert.equal(summary.shelfLife.expiringSoonCount, 1);
  assert.equal(summary.shelfLife.nearExpiry[0].daysUntilExpiry, 1);
  assert.equal(requests.find(({ url }) => url.pathname.endsWith("/ingredients")).url.searchParams.get("select"), "*");
});

test("shelf monitoring counts inventory beyond the first database page", async () => {
  const ingredients = Array.from({ length: 1001 }, (_, index) => ({
    id: index + 1, name: `Ingredient ${index + 1}`, current_stock: 10, reorder_level: 2,
    expires_on: index < 1000 ? "2026-11-12" : "2026-10-27", archived_at: index < 1000 ? null : "2026-10-28T00:00:00Z",
  }));
  const { service, requests } = mockApi({ ingredients });
  const summary = await service.getDashboardSummary(new Date("2026-10-28T04:00:00Z"));
  assert.equal(summary.shelfLife.freshCount, 1000);
  assert.equal(summary.shelfLife.expiredCount, 0);
  assert.equal(requests.filter(({ url }) => url.pathname.endsWith("/ingredients")).length, 2);
});

test("Potential Excess uses ingredient stock, shelf life and completed-order deductions", async () => {
  const { service, requests } = mockApi({
    ingredients: [1, 2, 3].map((id) => ({ id, name: `Ingredient ${id}`, current_stock: 10, expires_on: "2026-11-04", unit: "g" })),
    menuItems: [1, 2, 3].map((id) => ({ id, name: `Meal ${id}`, price: 40 + id * 10, is_active: true, created_at: "2026-09-01T00:00:00Z", menu_item_ingredients: [{ ingredient_id: id, quantity: 1 }] })),
    orders: [{ status: "Completed", created_at: "2026-10-27T04:00:00Z", order_items: [item(1, "Meal 1", 4, 200)] }],
    stockMovements: [{ id: 1, ingredient_id: 1, adjustment: -4, reason: "Order DY-001 completed", created_at: "2026-10-27T04:00:00Z" }],
  });
  const report = normalizeDashboardSummary(await service.getDashboardSummary(new Date("2026-10-28T04:00:00Z")));
  assert.equal(report.totalSales, 200);
  assert.equal(report.potentialExcess.consumptionDays, 7);
  assert.deepEqual(report.potentialExcess.items.map((row) => [row.name, row.potentialExcess, row.unit]), [["Ingredient 2", 10, "Grams"], ["Ingredient 3", 10, "Grams"], ["Ingredient 1", 6, "Grams"]]);
  assert.equal(requests.some(({ url }) => url.pathname.endsWith("feedback")), false);
  assert.equal(requests.some(({ url }) => url.pathname.endsWith("menu_items")), false);
  assert.equal(requests.some(({ url }) => url.pathname.endsWith("stock_movements")), true);
});
