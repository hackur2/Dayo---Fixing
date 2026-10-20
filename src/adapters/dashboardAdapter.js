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
    unit: item.unit ?? "",
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
    totalSales: Number(
      rawData.totalSales ?? rawData.total_sales ?? rawData.sales ?? 0
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