import { useEffect, useMemo, useState } from "react";

import { shelfLifeService } from "../services/shelfLifeService";
import { getDashboardDate } from "../utils/dashboardUtils";
import { getShelfLifeRows } from "../utils/shelfLifeUtils";
import { useInventoryRefreshVersion } from "./useInventoryRefreshVersion";

export function useShelfLifeData() {
  const [ingredients, setIngredients] = useState([]);
  const [asOfDate, setAsOfDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const inventoryVersion = useInventoryRefreshVersion();

  useEffect(() => {
    let cancelled = false;
    shelfLifeService.getIngredients().then((rows) => {
      if (!cancelled) {
        setIngredients(rows);
        setAsOfDate(getDashboardDate(new Date()));
      }
    }).catch((error) => {
      if (!cancelled) setLoadError(error.message || "Unable to load ingredient expiry dates.");
    }).finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [loadVersion, inventoryVersion]);

  function reload() {
    setIsLoading(true);
    setLoadError("");
    setLoadVersion((version) => version + 1);
  }

  const shelfLifeItems = useMemo(() => asOfDate ? getShelfLifeRows(ingredients, asOfDate) : [], [ingredients, asOfDate]);
  return { shelfLifeItems, isLoading, loadError, reload };
}
