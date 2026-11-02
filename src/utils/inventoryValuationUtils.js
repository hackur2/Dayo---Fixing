export function buildInventoryValuation(ingredients) {
  let totalValue = 0;
  let missingCostCount = 0;
  let pricedStockCount = 0;
  for (const ingredient of ingredients) {
    if (ingredient.archivedAt || ingredient.archived_at) continue;
    const stock = Math.max(0, Number(ingredient.currentStock ?? ingredient.current_stock) || 0);
    if (stock === 0) continue;
    const cost = ingredient.unitCost ?? ingredient.unit_cost;
    if (cost === null || cost === undefined || cost === "" || !Number.isFinite(Number(cost)) || Number(cost) < 0) { missingCostCount += 1; continue; }
    totalValue += stock * Number(cost);
    pricedStockCount += 1;
  }
  return { totalValue, missingCostCount, pricedStockCount, hasValue: missingCostCount === 0 || pricedStockCount > 0 };
}
