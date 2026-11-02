import { normalizeIngredientUnit } from "../utils/ingredientUnitUtils.js";

function normalizeRevenueTrendItem(item) {
  return {
    date: item.date ?? item.salesDate ?? item.sales_date ?? "",
    label: item.label ?? item.date ?? item.salesDate ?? item.sales_date ?? "",
    totalSales: Number(
      item.totalSales ?? item.total_sales ?? item.sales ?? item.revenue ?? 0
    ),
    totalOrders: Number(
      item.totalOrders ?? item.total_orders ?? item.orders ?? 0
    ),
  };
}

function normalizeOrderSourceItem(item) {
  return {
    source: item.source ?? item.orderSource ?? item.order_source ?? "Unknown",
    count: Number(item.count ?? item.total ?? item.orders ?? 0),
  };
}

function normalizePipelineItem(item) {
  return {
    status: item.status ?? "Pending",
    count: Number(item.count ?? item.total ?? item.orders ?? 0),
  };
}

function normalizeLowStockItem(item) {
  return {
    id: item.id,
    name: item.name ?? item.ingredientName ?? item.ingredient_name ?? "Item",
    currentStock: Number(
      item.currentStock ?? item.current_stock ?? item.stock ?? 0
    ),
    reorderLevel: Number(
      item.reorderLevel ?? item.reorder_level ?? item.minimumStock ?? 0
    ),
    unit: normalizeIngredientUnit(item.unit),
  };
}

function normalizeTopSellingItem(item) {
  return {
    id: item.id,
    name: item.name ?? item.itemName ?? item.item_name ?? "Menu Item",
    quantitySold: Number(
      item.quantitySold ?? item.quantity_sold ?? item.sold ?? item.quantity ?? 0
    ),
    revenue: Number(
      item.revenue ?? item.totalRevenue ?? item.total_revenue ?? item.sales ?? 0
    ),
    image: item.image ?? item.imageUrl ?? item.image_url ?? "",
  };
}

export function normalizeDashboardSummary(data) {
  const rawData = data?.dashboard ?? data?.summary ?? data?.data ?? data ?? {};
  const shelfLife = rawData.shelfLife ?? {};
  const potentialExcess = rawData.potentialExcess ?? {};

  const revenueTrend =
    rawData.revenueTrend ??
    rawData.revenue_trend ??
    rawData.salesTrend ??
    rawData.sales_trend ??
    [];

  const orderSources =
    rawData.orderSources ??
    rawData.order_sources ??
    rawData.sources ??
    [];

  const orderPipeline =
    rawData.orderPipeline ??
    rawData.order_pipeline ??
    rawData.pipeline ??
    [];

  const lowStockItems =
    rawData.lowStockItems ??
    rawData.low_stock_items ??
    rawData.lowStocks ??
    [];

  const topSellingItems =
    rawData.topSellingItems ??
    rawData.top_selling_items ??
    rawData.topItems ??
    [];

  return {
    asOfDate: rawData.asOfDate ?? "",
    ingredientCount: Number(rawData.ingredientCount ?? 0),
    potentialExcess: {
      consumptionDays: Number(potentialExcess.consumptionDays ?? 7),
      consumptionStartDate: potentialExcess.consumptionStartDate ?? "",
      consumptionEndDate: potentialExcess.consumptionEndDate ?? "",
      items: Array.isArray(potentialExcess.items) ? potentialExcess.items : [],
    },
    shelfLife: {
      freshCount: Number(shelfLife.freshCount ?? 0),
      expiringSoonCount: Number(shelfLife.expiringSoonCount ?? 0),
      expiredCount: Number(shelfLife.expiredCount ?? 0),
      undatedCount: Number(shelfLife.undatedCount ?? 0),
      nearExpiry: Array.isArray(shelfLife.nearExpiry) ? shelfLife.nearExpiry.map((item) => ({
        id: item.id, name: item.name ?? "Ingredient", expiresOn: item.expiresOn ?? "", daysUntilExpiry: Number(item.daysUntilExpiry ?? 0),
      })) : [],
    },
    customerActivity: Array.isArray(rawData.customerActivity)
      ? rawData.customerActivity.map((item) => ({ date: item.date ?? "", count: Number(item.count ?? 0) }))
      : [],
    totalSales: Number(
      rawData.totalSales ?? rawData.total_sales ?? rawData.sales ?? 0
    ),

    totalOrders: Number(rawData.totalOrders ?? rawData.total_orders ?? 0),

    todaySales: Number(rawData.todaySales ?? rawData.today_sales ?? 0),

    activeStaffCount: Number(
      rawData.activeStaffCount ?? rawData.active_staff_count ?? 0
    ),

    ordersToday: Number(
      rawData.ordersToday ??
        rawData.orders_today ??
        rawData.totalOrders ??
        rawData.total_orders ??
        0
    ),

    menuItemsCount: Number(
      rawData.menuItemsCount ??
        rawData.menu_items_count ??
        rawData.menuItems ??
        rawData.menu_items ??
        0
    ),

    feedbackCount: Number(
      rawData.feedbackCount ??
        rawData.feedback_count ??
        rawData.customerFeedback ??
        rawData.customer_feedback ??
        0
    ),

    lowStockCount: Number(
      rawData.lowStockCount ??
        rawData.low_stock_count ??
        rawData.lowStocksCount ??
        lowStockItems.length ??
        0
    ),

    revenueTrend: Array.isArray(revenueTrend)
      ? revenueTrend.map(normalizeRevenueTrendItem)
      : [],

    orderSources: Array.isArray(orderSources)
      ? orderSources.map(normalizeOrderSourceItem)
      : [],

    orderPipeline: Array.isArray(orderPipeline)
      ? orderPipeline.map(normalizePipelineItem)
      : [],

    lowStockItems: Array.isArray(lowStockItems)
      ? lowStockItems.map(normalizeLowStockItem)
      : [],

    topSellingItems: Array.isArray(topSellingItems)
      ? topSellingItems.map(normalizeTopSellingItem)
      : [],
  };
}
