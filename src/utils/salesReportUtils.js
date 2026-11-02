import { getDashboardDate } from "./dashboardUtils.js";
import { buildIngredientRevenue, getSalesHour } from "./salesAnalysisUtils.js";

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function buildSalesReport(orders, menuItems, menuCategories, { ingredients = [], recipes = [], combos = [] } = {}) {
  const menuById = new Map(menuItems.map((item) => [String(item.id), item]));
  const categoryById = new Map(menuCategories.map((category) => [String(category.id), category]));
  const categories = new Map(menuCategories.filter((category) => category.parent_id == null).map((category) => [
    `category:${category.id}`, { id: `category:${category.id}`, name: category.name, revenue: 0, quantitySold: 0 },
  ]));
  const subCategories = new Map(menuCategories.filter((category) => category.parent_id != null).map((category) => [
    `subcategory:${category.id}`, { id: `subcategory:${category.id}`, name: category.name, revenue: 0, quantitySold: 0 },
  ]));
  const days = new Map();
  const items = new Map();
  const hours = new Map();

  function categoriesForItem(menu) {
    let category = categoryById.get(String(menu?.subcategory_id))
      ?? categoryById.get(String(menu?.category_id));
    const subCategory = category?.parent_id != null ? category : null;
    const visited = new Set();
    while (category?.parent_id != null) {
      if (visited.has(String(category.id))) return { category: null, subCategory: null };
      visited.add(String(category.id));
      category = categoryById.get(String(category.parent_id));
    }
    return { category, subCategory: category ? subCategory : null };
  }

  for (const order of orders) {
    if (order.status !== "Completed") continue;
    const date = getDashboardDate(order.created_at);
    if (!date) continue;
    const day = days.get(date) ?? { date, totalSales: 0, totalOrders: 0, itemQuantities: {}, entitySales: {} };
    const time = getSalesHour(order.created_at);
    const hourKey = time ? `${time.date}:${time.hour}` : null;
    const hour = time ? hours.get(hourKey) ?? { ...time, totalSales: 0, totalOrders: 0, entitySales: {} } : null;
    day.totalOrders += 1;
    if (hour) hour.totalOrders += 1;
    for (const item of order.order_items ?? []) {
      const revenue = number(item.subtotal);
      const quantity = number(item.quantity);
      const { category, subCategory } = categoriesForItem(menuById.get(String(item.menu_item_id)));
      const categoryId = category ? `category:${category.id}` : "uncategorized";
      const categoryRow = categories.get(categoryId) ?? { id: categoryId, name: category?.name ?? "Uncategorized", revenue: 0, quantitySold: 0 };
      categoryRow.revenue += revenue;
      categoryRow.quantitySold += quantity;
      categories.set(categoryId, categoryRow);
      const subCategoryId = subCategory ? `subcategory:${subCategory.id}` : null;
      if (subCategoryId) {
        const subCategoryRow = subCategories.get(subCategoryId);
        subCategoryRow.revenue += revenue;
        subCategoryRow.quantitySold += quantity;
      }

      const id = item.menu_item_id != null ? `menu:${item.menu_item_id}` : `archived:${item.item_name}`;
      const row = items.get(id) ?? { id, menuItemId: item.menu_item_id ?? null, name: item.item_name || "Menu Item", quantitySold: 0, revenue: 0 };
      row.quantitySold += quantity;
      row.revenue += revenue;
      items.set(id, row);
      day.itemQuantities[id] = (day.itemQuantities[id] ?? 0) + quantity;
      day.totalSales += revenue;
      for (const entityId of [id, categoryId, subCategoryId].filter(Boolean)) {
        day.entitySales[entityId] = (day.entitySales[entityId] ?? 0) + revenue;
        if (hour) hour.entitySales[entityId] = (hour.entitySales[entityId] ?? 0) + revenue;
      }
      if (hour) hour.totalSales += revenue;
    }
    days.set(date, day);
    if (hour) hours.set(hourKey, hour);
  }

  const movementItems = menuItems.filter((item) => item.is_active !== false).map((item) => {
    const id = `menu:${item.id}`;
    const sales = items.get(id);
    const { category, subCategory } = categoriesForItem(item);
    const comparisonCategory = subCategory ?? category;
    return {
      id, name: item.name || sales?.name || "Menu Item", quantitySold: sales?.quantitySold ?? 0, revenue: sales?.revenue ?? 0,
      categoryId: comparisonCategory ? `category:${comparisonCategory.id}` : "uncategorized",
      categoryName: comparisonCategory?.name?.trim() || "Uncategorized",
    };
  });

  return {
    dailySales: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    categories: [...categories.values()].sort((a, b) => a.name.localeCompare(b.name)),
    subCategories: [...subCategories.values()].sort((a, b) => a.name.localeCompare(b.name)),
    items: [...items.values()].sort((a, b) => b.quantitySold - a.quantitySold || b.revenue - a.revenue || a.name.localeCompare(b.name)),
    movementItems,
    hourlySales: [...hours.values()].sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour),
    ingredients: buildIngredientRevenue([...items.values()], ingredients, recipes, combos),
  };
}

export function buildItemMovement(items, limit = 3) {
  const categories = new Map();
  const normalized = items.map((item) => ({
    ...item, quantitySold: Math.max(0, number(item.quantitySold)),
    categoryId: item.categoryId ?? "uncategorized", categoryName: item.categoryName || "Uncategorized",
  }));
  for (const item of normalized) {
    const category = categories.get(item.categoryId) ?? { id: item.categoryId, name: item.categoryName, itemCount: 0, totalUnitsSold: 0 };
    category.itemCount += 1;
    category.totalUnitsSold += item.quantitySold;
    categories.set(item.categoryId, category);
  }
  const ranked = normalized.map((item) => {
    const category = categories.get(item.categoryId);
    const threshold = (100 / category.itemCount) * 0.70;
    const popularity = category.totalUnitsSold > 0 ? item.quantitySold / category.totalUnitsSold * 100 : 0;
    // Compare before rounding; exact threshold ties qualify as fast-moving.
    const movement = item.quantitySold === 0 ? "non"
      : item.quantitySold * category.itemCount * 10 >= category.totalUnitsSold * 7 ? "fast" : "slow";
    return {
      ...item, popularity, threshold, movement,
      classification: movement === "fast" ? "Fast-moving" : movement === "slow" ? "Slow-moving" : "Non-moving",
      categoryItemCount: category.itemCount, categoryUnitsSold: category.totalUnitsSold,
    };
  }).sort((a, b) => b.quantitySold - a.quantitySold || a.name.localeCompare(b.name));
  const fast = ranked.filter((item) => item.movement === "fast").slice(0, limit);
  const slow = ranked.filter((item) => item.movement === "slow")
    .sort((a, b) => a.quantitySold - b.quantitySold || a.name.localeCompare(b.name)).slice(0, limit);
  return {
    data: [...fast, ...slow], items: ranked,
    categories: [...categories.values()].map((category) => ({ ...category, threshold: (100 / category.itemCount) * 0.70 }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    state: ranked.length === 0 ? "empty" : ranked.every((item) => item.movement === "non") ? "no-sales" : "ranked",
  };
}

export function buildItemSalesTrend(dailySales, items, limit = 3) {
  const topItems = items.slice(0, limit);
  const series = topItems.map((item, index) => ({ key: `item${index}`, name: item.name, id: item.id }));
  if (items.length > limit) series.push({ key: "other", name: "Other items" });
  const data = dailySales.map((day) => {
    const row = { date: day.date };
    let shown = 0;
    topItems.forEach((item, index) => {
      row[`item${index}`] = number(day.itemQuantities?.[item.id]);
      shown += row[`item${index}`];
    });
    if (items.length > limit) {
      row.other = Math.max(0, Object.values(day.itemQuantities ?? {}).reduce((total, quantity) => total + number(quantity), 0) - shown);
    }
    return row;
  });
  return { data, series };
}
