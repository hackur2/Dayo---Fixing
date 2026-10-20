function normalizeOrderItem(item) {
  return {
    id: item.id,
    name: item.name ?? item.menuItemName ?? item.menu_item_name ?? "Unnamed Item",
    quantity: Number(item.quantity ?? 0),
    price: Number(item.price ?? item.unitPrice ?? item.unit_price ?? 0),
    recommendationSource: item.recommendationSource ?? item.recommendation_source ?? null,
  };
}

export function normalizeSuperAdminOrder(order) {
  const rawItems = order.items ?? order.orderItems ?? order.order_items ?? [];

  return {
    id: order.id,
    orderNumber:
      order.orderNumber ?? order.order_number ?? `DYO-${order.id ?? "0000"}`,
    customerName:
      order.customerName ?? order.customer_name ?? order.customer ?? "Customer",
    source: order.source ?? order.orderSource ?? order.order_source ?? "QR Order",
    status: order.status ?? "Pending",
    paymentStatus:
      order.paymentStatus ?? order.payment_status ?? "Pending",
    paymentMethod:
      order.paymentMethod ?? order.payment_method ?? "Cash",
    orderDate:
      order.orderDate ?? order.order_date ?? order.date ?? "",
    orderTime:
      order.orderTime ?? order.order_time ?? order.time ?? "",
    totalAmount: Number(
      order.totalAmount ?? order.total_amount ?? order.total ?? 0
    ),
    items: Array.isArray(rawItems) ? rawItems.map(normalizeOrderItem) : [],
  };
}

export function normalizeSuperAdminOrders(data) {
  const rawOrders = Array.isArray(data)
    ? data
    : data?.orders ?? data?.items ?? data?.data ?? [];

  if (!Array.isArray(rawOrders)) {
    return [];
  }

  return rawOrders.map(normalizeSuperAdminOrder);
}
