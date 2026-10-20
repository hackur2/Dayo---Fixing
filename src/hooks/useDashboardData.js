import { useEffect, useState } from "react";
import { normalizeDashboardSummary } from "../adapters/dashboardAdapter";
import { dashboardService } from "../services/dashboardService";

export function useDashboardData() {
  const [dashboardData, setDashboardData] = useState(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

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
  }, []);

  return { dashboardData: dashboardData || normalizeDashboardSummary({}), isDashboardLoading, dashboardError };
}
