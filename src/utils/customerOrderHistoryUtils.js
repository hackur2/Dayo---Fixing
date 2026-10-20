// The browser keeps a short convenience history for the same device.
// The backend/database remains the source of truth for real orders.
const MAX_SAVED_ORDERS = 25;

export function saveOrderInHistory(existingOrders, order) {
  const orders = Array.isArray(existingOrders) ? existingOrders : [];

  if (!order?.orderNumber) {
    return orders;
  }

  return [
    order,
    ...orders.filter((item) => item?.orderNumber && item.orderNumber !== order.orderNumber),
  ].slice(0, MAX_SAVED_ORDERS);
}
