export const MANUAL_ORDER_SOURCE = "Manual Order Taker";

export function normalizeOrderSource(source) {
  return source === "Manual POS" ? MANUAL_ORDER_SOURCE : source;
}

export function getOrderSourceLabel(source) {
  return normalizeOrderSource(source) === MANUAL_ORDER_SOURCE ? "Order Taker" : source;
}
