export function createOrderPayload(checkoutForm, cartItems) {
  return {
    customerName: checkoutForm.customerName.trim(),
    orderType: checkoutForm.orderType,
    paymentMethod: checkoutForm.paymentMethod || "Cash",
    paymentReferenceNumber: checkoutForm.paymentMethod === "GCash"
      ? checkoutForm.paymentReferenceNumber.trim()
      : null,
    notes: checkoutForm.notes.trim(),
    items: cartItems.map((item) => ({
      menuItemId: item.id,
      name: item.name,
      selectedVariantId: item.selectedVariant?.id || null,
      variantLabel: item.variantLabel || null,
      price: Number(item.price),
      quantity: Number(item.quantity),
      recommendationSource: item.recommendationSource || null,
    })),
  };
}

function normalizeOrderItem(item) {
  const price = Number(item.price ?? 0);
  const quantity = Number(item.quantity ?? 0);

  return {
    menuItemId: item.menuItemId ?? item.menu_item_id ?? item.id ?? null,
    name: item.name ?? "Unnamed Item",
    selectedVariantId:
      item.selectedVariantId ?? item.selected_variant_id ?? null,
    variantLabel: item.variantLabel ?? item.variant_label ?? null,
    price,
    quantity,
    subtotal: Number(item.subtotal ?? price * quantity),
    recommendationSource:
      item.recommendationSource ?? item.recommendation_source ?? null,
  };
}

export function normalizeOrder(order) {
  const rawOrder = order?.data || order?.order || order;

  if (!rawOrder) {
    return null;
  }

  const items = Array.isArray(rawOrder.items)
    ? rawOrder.items.map(normalizeOrderItem)
    : [];

  return {
    id: rawOrder.id ?? null,
    orderNumber: rawOrder.orderNumber ?? rawOrder.order_number ?? "",
    customerName: rawOrder.customerName ?? rawOrder.customer_name ?? "",
    orderType: rawOrder.orderType ?? rawOrder.order_type ?? "",
    paymentMethod:
      rawOrder.paymentMethod ?? rawOrder.payment_method ?? "",
    paymentReferenceNumber:
      rawOrder.paymentReferenceNumber ??
      rawOrder.payment_reference_number ??
      rawOrder.gcashReferenceNumber ??
      rawOrder.gcash_reference_number ??
      null,
    notes: rawOrder.notes ?? "",
    status: rawOrder.status ?? "Pending",
    items,
    totalAmount: Number(
      rawOrder.totalAmount ??
        rawOrder.total_amount ??
        items.reduce((total, item) => total + item.subtotal, 0)
    ),
    createdAt:
      rawOrder.createdAt ??
      rawOrder.created_at ??
      new Date().toLocaleString(),
  };
}

export function normalizeOrders(data) {
  const rawOrders = Array.isArray(data)
    ? data
    : data?.orders || data?.data || [];

  if (!Array.isArray(rawOrders)) {
    return [];
  }

  return rawOrders.map(normalizeOrder).filter(Boolean);
}

export function normalizeOrderStatus(statusResponse) {
  const rawStatus = statusResponse?.data || statusResponse;

  return {
    orderNumber: rawStatus.orderNumber ?? rawStatus.order_number ?? "",
    status: rawStatus.status ?? "Pending",
    updatedAt:
      rawStatus.updatedAt ??
      rawStatus.updated_at ??
      new Date().toLocaleString(),
  };
}
