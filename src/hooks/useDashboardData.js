import { useEffect, useState } from "react";
import { normalizeDashboardSummary } from "../adapters/dashboardAdapter";
import { dashboardService } from "../services/dashboardService";
import { INVENTORY_REFRESH_EVENT } from "../utils/ingredientExpiryUtils";

export function useDashboardData() {
  const [dashboardData, setDashboardData] = useState(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => { setIsDashboardLoading(true); setDashboardError(""); setVersion((current) => current + 1); };
    window.addEventListener(INVENTORY_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(INVENTORY_REFRESH_EVENT, refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    dashboardService.getDashboardSummary().then((data) => {
      if (!cancelled) setDashboardData(normalizeDashboardSummary(data));
    }).catch((error) => {
      console.error("Unable to load dashboard data:", error.message);
      if (!cancelled) setDashboardError("Unable to load dashboard data from Supabase.");
    }).finally(() => {
      if (!cancelled) setIsDashboardLoading(false);
    });
    return () => { cancelled = true; };
  }, [version]);

  return { dashboardData: dashboardData || normalizeDashboardSummary({}), isDashboardLoading, dashboardError };
}
