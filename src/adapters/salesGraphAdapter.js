export function normalizeSalesGraphItem(item) {
  return {
    date: item.date ?? item.salesDate ?? item.sales_date ?? "",
    totalSales: Number(
      item.totalSales ?? item.total_sales ?? item.sales ?? item.revenue ?? 0
    ),
    totalOrders: Number(
      item.totalOrders ?? item.total_orders ?? item.orders ?? 0
    ),
  };
}

export function normalizeSalesGraphData(data) {
  const rawGraphData = Array.isArray(data)
    ? data
    : data?.salesGraphData ??
      data?.salesGraph ??
      data?.sales_graph ??
      data?.graphData ??
      data?.items ??
      data?.data ??
      [];

  if (!Array.isArray(rawGraphData)) {
    return [];
  }

  return rawGraphData.map(normalizeSalesGraphItem);
}