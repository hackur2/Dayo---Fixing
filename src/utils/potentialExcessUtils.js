import { getDashboardDate } from "./dashboardUtils.js";

const DAY_MS = 86400000;
const CONSUMPTION_DAYS = 7;

function dateStamp(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return null;
  const stamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value ? stamp : null;
}

export function getConsumptionWindow(asOfDate) {
  const today = dateStamp(asOfDate);
  if (today === null) throw new Error("A valid date is required for Potential Excess.");
  return {
    asOfDate,
    consumptionDays: CONSUMPTION_DAYS,
    consumptionStartDate: new Date(today - CONSUMPTION_DAYS * DAY_MS).toISOString().slice(0, 10),
    consumptionEndDate: new Date(today - DAY_MS).toISOString().slice(0, 10),
  };
}

export function calculatePotentialExcess(currentStock, weeklyConsumption, remainingShelfLife) {
  if ([currentStock, weeklyConsumption, remainingShelfLife].some((value) => !Number.isFinite(value) || value < 0)) return null;
  return Math.max(0, currentStock - (weeklyConsumption / 7 * remainingShelfLife));
}

export function buildPotentialExcess({ ingredients, stockMovements = [], asOfDate }, limit = 3) {
  const window = getConsumptionWindow(asOfDate);
  const today = dateStamp(asOfDate);
  const consumption = new Map();
  for (const movement of stockMovements) {
    const adjustment = Number(movement.adjustment);
    // Completed-order deductions are logged by the inventory completion trigger.
    // Manual edits and restocks do not represent consumption.
    if (!Number.isFinite(adjustment) || adjustment >= 0 || movement.ingredient_id == null
      || !/^Order .+ completed$/i.test(String(movement.reason ?? "").trim()) || !movement.created_at) continue;
    const date = getDashboardDate(movement.created_at);
    if (!date || date < window.consumptionStartDate || date > window.consumptionEndDate) continue;
    const id = String(movement.ingredient_id);
    consumption.set(id, (consumption.get(id) ?? 0) - adjustment);
  }

  const items = ingredients.map((ingredient) => {
    const rawStock = ingredient.currentStock;
    const currentStock = rawStock != null && rawStock !== "" && Number.isFinite(Number(rawStock)) && Number(rawStock) >= 0 ? Number(rawStock) : null;
    const expiry = dateStamp(ingredient.expiresOn);
    const remainingShelfLife = expiry === null ? null : Math.max(0, Math.round((expiry - today) / DAY_MS));
    const weeklyConsumption = consumption.get(String(ingredient.id)) ?? 0;
    return {
      id: ingredient.id,
      name: ingredient.name || "Ingredient",
      unit: ingredient.unit || "units",
      expiresOn: expiry === null ? "" : ingredient.expiresOn,
      isExpired: expiry !== null && expiry < today,
      currentStock,
      weeklyConsumption,
      remainingShelfLife,
      potentialExcess: calculatePotentialExcess(currentStock, weeklyConsumption, remainingShelfLife),
      unavailableReason: currentStock === null ? "Valid current stock needed" : remainingShelfLife === null ? "Expiry date needed" : "",
    };
  }).sort((a, b) => Number(b.potentialExcess !== null) - Number(a.potentialExcess !== null)
    || (b.potentialExcess ?? 0) - (a.potentialExcess ?? 0)
    || a.name.localeCompare(b.name));
  return { ...window, items: items.slice(0, limit) };
}
