import { useEffect, useState } from "react";
import { normalizeSalesGraphData } from "../adapters/salesGraphAdapter";
import { salesGraphService } from "../services/salesGraphService";

export function useSalesGraphData(startDate, endDate) {
  const [salesGraphData, setSalesGraphData] = useState([]);
  const [isSalesGraphLoading, setIsSalesGraphLoading] = useState(true);
  const [salesGraphError, setSalesGraphError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsSalesGraphLoading(true);
    salesGraphService.getSalesGraph(startDate, endDate).then((data) => {
      if (!cancelled) setSalesGraphData(normalizeSalesGraphData(data));
    }).catch((error) => {
      console.error("Unable to load sales graph data:", error.message);
      if (!cancelled) setSalesGraphError("Unable to load sales graph data from Supabase.");
    }).finally(() => {
      if (!cancelled) setIsSalesGraphLoading(false);
    });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  return { salesGraphData, isSalesGraphLoading, salesGraphError };
}
