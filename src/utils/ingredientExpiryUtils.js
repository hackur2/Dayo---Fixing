import { getDashboardDate } from "./dashboardUtils.js";

export const INVENTORY_REFRESH_EVENT = "dayo:inventory-refreshed";

export function notifyInventoryRefresh() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(INVENTORY_REFRESH_EVENT));
}

export function getExpiryReminders(ingredients, now = new Date()) {
  const today = Date.parse(`${getDashboardDate(now)}T00:00:00Z`);
  return ingredients.flatMap((ingredient) => {
    const stock = Number(ingredient.current_stock);
    if (ingredient.archived_at || !Number.isFinite(stock) || stock <= 0 || !ingredient.expires_on) return [];
    const expiry = Date.parse(`${ingredient.expires_on}T00:00:00Z`);
    if (!Number.isFinite(expiry) || new Date(expiry).toISOString().slice(0, 10) !== ingredient.expires_on) return [];
    const days = Math.round((expiry - today) / 86400000);
    return days >= 1 && days <= 3 ? [{ ...ingredient, daysUntilExpiry: days }] : [];
  }).sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry || a.name.localeCompare(b.name));
}
