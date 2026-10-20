import { useEffect, useState } from "react";

import { orderService } from "../services/orderService";
import { normalizeOrder, normalizeOrderStatus } from "../adapters/orderAdapter";

export function useCurrentOrderData(currentOrder, onOrderUpdated) {
  const [orderData, setOrderData] = useState(() => normalizeOrder(currentOrder));
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");

  useEffect(() => {
    if (!currentOrder?.orderNumber) {
      setOrderData(null);
      setOrderError("");
      setIsLoadingOrder(false);
      return undefined;
    }

    // Show the last server-confirmed order while the latest status is fetched.
    setOrderData(normalizeOrder(currentOrder));
    setOrderError("");

    let cancelled = false;

    async function loadOrderData() {
      try {
        setIsLoadingOrder(true);
        const response = await orderService.getOrderByOrderNumber(currentOrder.orderNumber);
        if (cancelled) return;
        const latestOrder = normalizeOrder(response);
        const savedSources = new Map(normalizeOrder(currentOrder)?.items.map((item) => [
          `${item.menuItemId}-${item.selectedVariantId || "regular"}`,
          item.recommendationSource,
        ]) || []);
        const updatedOrder = {
          ...latestOrder,
          items: latestOrder.items.map((item) => ({
            ...item,
            recommendationSource: item.recommendationSource || savedSources.get(
              `${item.menuItemId}-${item.selectedVariantId || "regular"}`
            ),
          })),
        };
        setOrderData(updatedOrder);
        onOrderUpdated?.(updatedOrder);
      } catch (error) {
        if (cancelled) return;
        console.error("Unable to load order data:", error.message);
        setOrderError("Unable to load updated order data. Showing saved order details for now.");
      } finally {
        if (!cancelled) setIsLoadingOrder(false);
      }
    }

    loadOrderData();
    // QR customer sessions cannot subscribe to protected order rows, so poll the guarded RPC.
    const timer = window.setInterval(loadOrderData, 8000);
    return () => { cancelled = true; window.clearInterval(timer); };
  // Loading depends on the selected ID, not on every status update to that order.
  }, [currentOrder?.orderNumber, onOrderUpdated]);

  async function refreshOrderStatus() {
    if (!orderData?.orderNumber || isLoadingOrder) return;

    try {
      setIsLoadingOrder(true);
      setOrderError("");
      const response = await orderService.getOrderStatusByOrderNumber(orderData.orderNumber);
      const normalizedStatus = normalizeOrderStatus(response);
      const updatedOrder = { ...orderData, status: normalizedStatus.status };
      setOrderData(updatedOrder);
      onOrderUpdated?.(updatedOrder);
    } catch (error) {
      console.error("Unable to refresh order status:", error.message);
      setOrderError("Unable to refresh order status right now. Please try again later.");
    } finally {
      setIsLoadingOrder(false);
    }
  }

  return { orderData, isLoadingOrder, orderError, refreshOrderStatus };
}
