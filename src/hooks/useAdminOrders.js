import { useEffect, useState } from "react";
import { orderService } from "../services/orderService";
import { normalizeOrders } from "../adapters/orderAdapter";
import { supabase } from "../lib/supabase";

export function useAdminOrders(statusFilter = "All") {
  const [adminOrders, setAdminOrders] = useState([]);
  const [isLoadingAdminOrders, setIsLoadingAdminOrders] = useState(true);
  const [adminOrdersError, setAdminOrdersError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let hasLoaded = false;
    async function load() {
      try {
        if (!hasLoaded) setIsLoadingAdminOrders(true);
        setAdminOrdersError("");
        const data = await orderService.getOrders({ status: statusFilter });
        if (!cancelled) setAdminOrders(normalizeOrders(data));
      } catch (error) {
        console.error("Unable to load orders:", error.message);
        if (!cancelled) setAdminOrdersError("Unable to load orders from Supabase.");
      } finally {
        hasLoaded = true;
        if (!cancelled) setIsLoadingAdminOrders(false);
      }
    }
    load();
    const timer = window.setInterval(load, 8000);
    const channel = supabase?.channel("admin-orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { cancelled = true; window.clearInterval(timer); if (channel) supabase.removeChannel(channel); };
  }, [statusFilter]);

  return { adminOrders, isLoadingAdminOrders, adminOrdersError };
}
