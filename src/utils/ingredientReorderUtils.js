export const INGREDIENT_ADS_DAYS = 30;
export const INGREDIENT_LEAD_TIME_DAYS = 1;
export const INGREDIENT_BUFFER_DAYS = 1;

export function getIngredientSalesWindow(now = new Date()) {
  const end = new Date(now);
  if (!Number.isFinite(end.getTime())) throw new Error("A valid date is required to calculate ingredient reorder points.");
  return {
    start: new Date(end.getTime() - INGREDIENT_ADS_DAYS * 86400000).toISOString(),
    end: end.toISOString(),
  };
}

export function calculateIngredientReorderPoint(quantitySold30Days) {
  const quantity = Number(quantitySold30Days);
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Ingredient sales quantity must be a non-negative number.");
  const averageDailySales = quantity / INGREDIENT_ADS_DAYS;
  const safetyStock = averageDailySales * INGREDIENT_BUFFER_DAYS;
  const reorderPoint = averageDailySales * INGREDIENT_LEAD_TIME_DAYS + safetyStock;
  // Ingredient stock and saved reorder levels use three decimal places.
  const reorderLevel = Math.ceil(Number(reorderPoint.toFixed(10)) * 1000) / 1000;
  return { quantitySold30Days: quantity, averageDailySales, safetyStock, reorderPoint, reorderLevel };
}

export function getIngredientSalesTotals(stockMovements, now = new Date()) {
  const { start, end } = getIngredientSalesWindow(now);
  const first = Date.parse(start);
  const last = Date.parse(end);
  const totals = new Map();
  for (const row of stockMovements) {
    const quantity = -Number(row.adjustment);
    const timestamp = Date.parse(row.created_at);
    if (row.ingredient_id == null || !Number.isFinite(quantity) || quantity <= 0
      || !/^Order .+ completed$/i.test(String(row.reason ?? "").trim())
      || !Number.isFinite(timestamp) || timestamp < first || timestamp > last) continue;
    const id = String(row.ingredient_id);
    totals.set(id, (totals.get(id) ?? 0) + quantity);
  }
  return totals;
}

export function applyIngredientReorderPoints(ingredients, totals, now = new Date()) {
  const window = getIngredientSalesWindow(now);
  return ingredients.map((ingredient) => {
    const values = calculateIngredientReorderPoint(totals.get(String(ingredient.id)) ?? 0);
    return {
      ...ingredient, reorder_level: values.reorderLevel,
      quantity_sold_30_days: values.quantitySold30Days,
      average_daily_sales: values.averageDailySales, safety_stock: values.safetyStock,
      reorder_point: values.reorderPoint,
      reorder_period_start: window.start, reorder_period_end: window.end,
    };
  });
}
