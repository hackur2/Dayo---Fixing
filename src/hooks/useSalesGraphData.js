import { useEffect, useState } from "react";
import { normalizeSalesGraphData } from "../adapters/salesGraphAdapter";
import { salesGraphService } from "../services/salesGraphService";

const EMPTY_REPORT = { dailySales: [], categories: [], subCategories: [], items: [], movementItems: [], hourlySales: [], ingredients: [] };

export function useSalesGraphData(startDate, endDate, loadReport = salesGraphService.getSalesReport, refreshKey = 0) {
  const [result, setResult] = useState({
    startDate: null, endDate: null, refreshKey: null, report: EMPTY_REPORT, error: "",
  });
  const isSalesGraphLoading = result.startDate !== startDate || result.endDate !== endDate || result.refreshKey !== refreshKey;

  useEffect(() => {
    let cancelled = false;
    loadReport(startDate, endDate).then((report) => {
      if (!cancelled) setResult({ startDate, endDate, refreshKey, report: { ...report, dailySales: normalizeSalesGraphData(report.dailySales) }, error: "" });
    }).catch((error) => {
      console.error("Unable to load sales graph data:", error.message);
      if (!cancelled) {
        setResult({ startDate, endDate, refreshKey, report: EMPTY_REPORT, error: "Unable to load sales graph data from Supabase." });
      }
    });
    return () => { cancelled = true; };
  }, [startDate, endDate, loadReport, refreshKey]);

  return {
    salesGraphData: isSalesGraphLoading ? EMPTY_REPORT.dailySales : result.report.dailySales,
    salesReport: isSalesGraphLoading ? EMPTY_REPORT : result.report,
    isSalesGraphLoading,
    salesGraphError: isSalesGraphLoading ? "" : result.error,
  };
}
