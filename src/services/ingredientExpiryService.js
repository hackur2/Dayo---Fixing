import { supabase } from "../lib/supabase";
import { getDashboardDate } from "../utils/dashboardUtils";
import { notifyInventoryRefresh } from "../utils/ingredientExpiryUtils";

const checks = new WeakMap();
export async function synchronizeIngredientExpiry(client, now = new Date()) {
  if (!client) throw new Error("Supabase is not configured.");
  const today = getDashboardDate(now);
  const previous = checks.get(client);
  if (previous?.pending) return previous.pending;
  if (previous?.date === today && Date.now() - previous.checkedAt < 5000) return { configured: previous.configured, updatedIds: [] };
  const state = { date: today, pending: null };
  state.pending = (async () => {
    const { data, error } = await client.rpc("zero_expired_ingredient_stock");
    if (error && !["PGRST202", "42883"].includes(error.code)) throw error;
    const configured = !error;
    const updatedIds = Array.isArray(data) ? data : [];
    checks.set(client, { date: today, checkedAt: Date.now(), configured });
    if (updatedIds.length > 0 || (previous?.date && previous.date !== today)) notifyInventoryRefresh();
    return { configured, updatedIds };
  })().catch((error) => { checks.delete(client); throw error; });
  checks.set(client, state);
  return state.pending;
}

export const ingredientExpiryService = {
  synchronize: () => synchronizeIngredientExpiry(supabase),
};
