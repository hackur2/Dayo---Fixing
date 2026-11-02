import { useEffect, useMemo, useState } from "react";

import { normalizeIngredient } from "../adapters/inventoryAdapter";
import { inventoryService } from "../services/inventoryService";
import { supplierService } from "../services/supplierService";
import { getLowStockRows } from "../utils/lowStockUtils";
import { useInventoryRefreshVersion } from "./useInventoryRefreshVersion";

export function useLowStockData() {
  const [ingredients, setIngredients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const inventoryVersion = useInventoryRefreshVersion();

  useEffect(() => {
    let cancelled = false;
    Promise.all([inventoryService.getIngredients(), supplierService.getSuppliers()])
      .then(([ingredientRows, supplierRows]) => {
        if (cancelled) return;
        setIngredients(ingredientRows.map(normalizeIngredient));
        setSuppliers(supplierRows);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message || "Unable to load low-stock ingredients.");
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [loadVersion, inventoryVersion]);

  function reload() {
    setIsLoading(true);
    setLoadError("");
    setLoadVersion((version) => version + 1);
  }

  async function saveSupplier(ingredient, supplierId, details) {
    const values = { ...details, ingredient: ingredient.name };
    const supplier = supplierId != null
      ? await supplierService.updateSupplier(supplierId, values)
      : await supplierService.createSupplier(values);
    setSuppliers((rows) => supplierId != null
      ? rows.map((row) => row.id === supplier.id ? supplier : row)
      : [...rows, supplier]);
    return supplier;
  }

  const lowStockItems = useMemo(() => getLowStockRows(ingredients, suppliers), [ingredients, suppliers]);
  return { lowStockItems, isLoading, loadError, reload, saveSupplier };
}
