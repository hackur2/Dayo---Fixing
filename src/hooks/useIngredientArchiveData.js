import { useEffect, useState } from "react";
import { ingredientArchiveService } from "../services/ingredientArchiveService";
import { useInventoryRefreshVersion } from "./useInventoryRefreshVersion";

export function useIngredientArchiveData() {
  const [ingredients, setIngredients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [version, setVersion] = useState(0);
  const inventoryVersion = useInventoryRefreshVersion();

  useEffect(() => {
    let cancelled = false;
    ingredientArchiveService.getArchivedIngredients().then((rows) => {
      if (!cancelled) setIngredients(rows);
    }).catch((error) => {
      if (!cancelled) setLoadError(error.message || "Unable to load archived ingredients.");
    }).finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [version, inventoryVersion]);

  function reload() {
    setIsLoading(true);
    setLoadError("");
    setVersion((value) => value + 1);
  }
  return { ingredients, isLoading, loadError, reload };
}
