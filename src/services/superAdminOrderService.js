import { orderService } from "./orderService";

function mapOrder(order) {
  const items = (order.items || []).map((item, index) => ({ ...item, id: item.id || `${order.id}-${index}` }));
  const source = items.some((item) => item.recommendationSource === "Sumo AI")
    ? "Sumo AI"
    : order.source || "QR Order";
  const createdAt = order.createdAt || order.created_at;
  return { ...order, createdAt, orderDate: createdAt?.slice(0, 10),
    orderTime: createdAt ? new Date(createdAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) : "",
    source, paymentStatus: order.paymentStatus || (order.status === "Completed" ? "Paid" : "Pending"),
    items };
}

export const superAdminOrderService = {
  async getOrders() { return (await orderService.getOrders()).map(mapOrder); },
  async getOrderById(orderId) { const order = (await orderService.getOrders()).find((item) => String(item.id) === String(orderId)); return order ? mapOrder(order) : null; },
};
