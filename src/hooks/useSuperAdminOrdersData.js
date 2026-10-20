import { useEffect, useState } from "react";
import { superAdminOrderService } from "../services/superAdminOrderService";
import { normalizeSuperAdminOrders } from "../adapters/superAdminOrderAdapter";
import { supabase } from "../lib/supabase";

export function useSuperAdminOrdersData() {
  const [orders, setOrders] = useState([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = () => superAdminOrderService.getOrders().then((response) => {
      if (!cancelled) setOrders(normalizeSuperAdminOrders(response));
    }).catch((error) => {
      console.error("Unable to load orders:", error.message);
      if (!cancelled) setOrdersError("Unable to load orders from Supabase.");
    }).finally(() => {
      if (!cancelled) setIsOrdersLoading(false);
    });
    load();
    const timer = window.setInterval(load, 8000);
    const channel = supabase?.channel("super-admin-orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { cancelled = true; window.clearInterval(timer); if (channel) supabase.removeChannel(channel); };
  }, []);

  return { orders, isOrdersLoading, ordersError };
}
