import { useEffect, useRef, useState } from "react";
import { orderService } from "../services/orderService";
import { normalizeOrderStatus, normalizeOrders } from "../adapters/orderAdapter";
import { supabase } from "../lib/supabase";

export function useKdsOrders() {
  const [kdsOrders, setKdsOrders] = useState([]);
  const [isLoadingKdsOrders, setIsLoadingKdsOrders] = useState(true);
  const [kdsError, setKdsError] = useState("");
  const autoCancelInFlight = useRef(new Set());
  let hasLoaded = false;

  async function loadKdsOrders() {
    try {
      if (!hasLoaded) setIsLoadingKdsOrders(true);
      setKdsError("");
      setKdsOrders(normalizeOrders(await orderService.getKdsOrders()));
    } catch (error) {
      console.error("Unable to load KDS orders:", error.message);
      setKdsError("Unable to load KDS orders from Supabase.");
    } finally {
      hasLoaded = true;
      setIsLoadingKdsOrders(false);
    }
  }

  useEffect(() => {
    loadKdsOrders();
    const timer = window.setInterval(loadKdsOrders, 8000);
    const channel = supabase?.channel("kds-orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadKdsOrders)
      .subscribe();
    return () => { window.clearInterval(timer); if (channel) supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      kdsOrders.forEach((order) => {
        if (order.status !== "Pending" || autoCancelInFlight.current.has(order.orderNumber)) return;
        const createdAt = new Date(order.createdAt).getTime();
        if (!Number.isFinite(createdAt) || now - createdAt < 5 * 60 * 1000) return;

        autoCancelInFlight.current.add(order.orderNumber);
        updateKdsOrderStatus(order.orderNumber, "Cancelled")
          .catch(() => {})
          .finally(() => autoCancelInFlight.current.delete(order.orderNumber));
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [kdsOrders]);

  async function updateKdsOrderStatus(orderNumber, nextStatus) {
    try {
      setKdsError("");
      const data = await orderService.updateOrderStatus(orderNumber, nextStatus);
      const status = normalizeOrderStatus(data).status;
      setKdsOrders((orders) => orders.map((order) => order.orderNumber === orderNumber ? { ...order, status } : order));
    } catch (error) {
      setKdsError("Unable to update order status in Supabase.");
      throw error;
    }
  }

  return {
    kdsOrders,
    isLoadingKdsOrders,
    kdsError,
    updateKdsOrderStatus,
    cancelKdsOrder: (orderNumber) => updateKdsOrderStatus(orderNumber, "Cancelled"),
    refreshKdsOrders: loadKdsOrders,
  };
}
