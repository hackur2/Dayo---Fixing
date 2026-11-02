import { useEffect, useState } from "react";
import { potentialExcessService } from "../services/potentialExcessService";
import { INVENTORY_REFRESH_EVENT } from "../utils/ingredientExpiryUtils";

const EMPTY_ESTIMATE = { items: [], consumptionDays: 7, consumptionStartDate: "", consumptionEndDate: "", asOfDate: "" };

export function usePotentialExcessData(refreshKey = 0) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState({ refreshKey: null, version: -1, estimate: EMPTY_ESTIMATE, error: "" });
  const isLoading = result.refreshKey !== refreshKey || result.version !== version;
  useEffect(() => {
    const refresh = () => setVersion((current) => current + 1);
    window.addEventListener(INVENTORY_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(INVENTORY_REFRESH_EVENT, refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    potentialExcessService.getEstimate().then((estimate) => {
      if (!cancelled) setResult({ refreshKey, version, estimate, error: "" });
    }).catch((error) => {
      if (!cancelled) setResult({ refreshKey, version, estimate: EMPTY_ESTIMATE, error: error.message || "Unable to load potential excess." });
    });
    return () => { cancelled = true; };
  }, [refreshKey, version]);

  return {
    estimate: isLoading ? EMPTY_ESTIMATE : result.estimate,
    isLoading,
    error: isLoading ? "" : result.error,
    reload: () => setVersion((current) => current + 1),
  };
}
