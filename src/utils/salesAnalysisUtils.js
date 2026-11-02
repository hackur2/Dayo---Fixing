import { getDashboardDate } from "./dashboardUtils.js";

const DAY_MS = 86400000;
const stamp = (date) => date.toISOString().slice(0, 10);
const parse = (date) => new Date(`${date}T00:00:00Z`);
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const hourFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", hourCycle: "h23" });

export function sharePercentage(value, total) {
  return total > 0 ? value / total * 100 : null;
}

export function getSalesTrendEntities(report) {
  const categories = (report.categories ?? []).filter((category) => category.id !== "uncategorized");
  const isDrink = (category) => /^drinks?$/i.test(category.name.trim());
  const items = new Map([...(report.movementItems ?? []), ...(report.items ?? [])].map((item) => [item.id, item]));
  return {
    items: [...items.values()].sort((a, b) => a.name.localeCompare(b.name)),
    mainCategories: [
      { id: "group:food", name: "Food", categoryIds: categories.filter((category) => !isDrink(category)).map((category) => category.id) },
      { id: "group:drink", name: "Drink", categoryIds: categories.filter(isDrink).map((category) => category.id) },
    ],
    // Existing food menu groups sit alongside the stored child categories.
    subCategories: [
      ...categories.filter((category) => !/^(foods?|drinks?)$/i.test(category.name.trim())),
      ...(report.subCategories ?? []),
    ].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function buildSalesTrendSeries(report, interval = "day", range = {}, mode = "items") {
  const groups = getSalesTrendEntities(report);
  const entities = mode === "main" ? groups.mainCategories : mode === "subcategory" ? groups.subCategories : groups.items;
  const series = entities.map((entity, index) => ({ id: entity.id, name: entity.name, key: `entity${index}` }));
  const data = buildSalesTrend(report, interval, range).map(({ key, label }) => ({ key, label }));
  entities.forEach((entity, index) => {
    const trend = buildSalesTrend(report, interval, range, entity.categoryIds ?? entity.id);
    trend.forEach((row, rowIndex) => { data[rowIndex][series[index].key] = row.totalSales; });
  });
  return { data, series };
}

export function buildSalesTrend(report, interval = "day", { startDate = "", endDate = "" } = {}, entityId = "") {
  const daily = report.dailySales ?? [];
  const first = startDate || daily[0]?.date;
  const last = endDate || daily.at(-1)?.date;
  if (!first || !last || first > last) return [];
  const inside = (date) => date >= first && date <= last;
  const revenue = (row) => Array.isArray(entityId)
    ? entityId.reduce((total, id) => total + number(row.entitySales?.[id]), 0)
    : entityId ? number(row.entitySales?.[entityId]) : number(row.totalSales);
  if (interval === "hour") {
    const hours = Array.from({ length: 24 }, (_, hour) => ({ key: String(hour), label: `${String(hour).padStart(2, "0")}:00`, totalSales: 0, totalOrders: 0 }));
    for (const row of report.hourlySales ?? []) {
      if (!inside(row.date)) continue;
      hours[row.hour].totalSales += revenue(row);
      hours[row.hour].totalOrders += row.totalOrders;
    }
    return hours;
  }
  const bucketKey = (date) => {
    if (interval === "month") return `${date.slice(0, 7)}-01`;
    if (interval === "week") {
      const monday = parse(date);
      monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
      return stamp(monday);
    }
    return date;
  };
  const buckets = new Map();
  for (let cursor = parse(first); stamp(cursor) <= last; cursor = new Date(cursor.getTime() + DAY_MS)) {
    const date = stamp(cursor);
    const key = bucketKey(date);
    if (!buckets.has(key)) buckets.set(key, { key, label: interval === "month" ? key.slice(0, 7) : interval === "week" ? `Week of ${key}` : key, totalSales: 0, totalOrders: 0 });
  }
  for (const row of daily) {
    if (!inside(row.date)) continue;
    const bucket = buckets.get(bucketKey(row.date));
    bucket.totalSales += revenue(row);
    bucket.totalOrders += row.totalOrders;
  }
  return [...buckets.values()];
}

export function summarizeSales(report, range, overallReport = report) {
  const daily = buildSalesTrend(report, "day", range);
  const totalSales = daily.reduce((sum, row) => sum + row.totalSales, 0);
  const totalOrders = daily.reduce((sum, row) => sum + row.totalOrders, 0);
  const averageDailySales = daily.length ? totalSales / daily.length : 0;
  const highestSalesDay = daily.reduce((peak, row) => row.totalSales > (peak?.totalSales ?? 0) ? row : peak, null);
  const overallSales = (overallReport.dailySales ?? []).reduce((sum, row) => sum + row.totalSales, 0);
  const overallOrders = (overallReport.dailySales ?? []).reduce((sum, row) => sum + row.totalOrders, 0);
  return {
    totalSales, totalOrders, averageDailySales, highestSalesDay,
    salesShare: sharePercentage(totalSales, overallSales),
    ordersShare: sharePercentage(totalOrders, overallOrders),
    averageToPeak: sharePercentage(averageDailySales, highestSalesDay?.totalSales ?? 0),
    peakShare: sharePercentage(highestSalesDay?.totalSales ?? 0, totalSales),
  };
}

export function buildIngredientRevenue(items, ingredients = [], recipes = [], combos = []) {
  const ingredientMap = new Map(ingredients.map((row) => [String(row.id), row]));
  const totals = new Map(ingredients.filter((row) => !row.archived_at).map((row) => [String(row.id), { id: `ingredient:${row.id}`, name: row.name, revenue: 0 }]));
  let unallocated = 0;
  function requirements(menuId, visited = new Set()) {
    const key = String(menuId);
    if (visited.has(key)) return null;
    const nextVisited = new Set([...visited, key]);
    const direct = recipes.filter((row) => String(row.menu_item_id) === key);
    const components = combos.filter((row) => String(row.combo_menu_item_id) === key);
    const nested = components.map((row) => {
      const recipe = requirements(row.component_menu_item_id, nextVisited);
      return recipe?.length ? recipe.map((requirement) => ({ ...requirement, quantity: number(requirement.quantity) * number(row.quantity ?? 1) })) : null;
    });
    if (nested.some((value) => value === null)) return null;
    return [...direct, ...nested.flat()];
  }
  for (const item of items) {
    const recipe = item.menuItemId != null ? requirements(item.menuItemId) : null;
    const costs = recipe?.map((row) => {
      const ingredient = ingredientMap.get(String(row.ingredient_id));
      const cost = ingredient?.unit_cost;
      return { id: String(row.ingredient_id), name: ingredient?.name, cost: cost != null && Number.isFinite(Number(cost)) && Number(cost) >= 0 ? number(row.quantity) * Number(cost) : null };
    });
    const totalCost = costs?.reduce((sum, row) => sum + (row.cost ?? 0), 0) ?? 0;
    if (!costs?.length || costs.some((row) => row.cost === null) || totalCost <= 0) { unallocated += item.revenue; continue; }
    for (const row of costs) {
      const total = totals.get(row.id) ?? { id: `ingredient:${row.id}`, name: row.name, revenue: 0 };
      total.revenue += item.revenue * row.cost / totalCost;
      totals.set(row.id, total);
    }
  }
  const rows = [...totals.values()];
  if (unallocated > 0) rows.push({ id: "ingredient:unallocated", name: "Unallocated", revenue: unallocated });
  return rows.sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
}

export function getDashboardShares(data) {
  const completed = data.orderPipeline.find((row) => row.status === "Completed")?.count ?? 0;
  return {
    revenue: sharePercentage(data.todaySales, data.totalSales),
    orders: sharePercentage(completed, data.totalOrders),
    lowStock: sharePercentage(data.lowStockCount, data.ingredientCount),
  };
}

export function getSalesHour(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : { date: getDashboardDate(date), hour: Number(hourFormatter.format(date)) };
}
