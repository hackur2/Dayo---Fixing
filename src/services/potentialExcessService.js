import { supabase } from "../lib/supabase";
import { normalizeIngredient } from "../adapters/inventoryAdapter";
import { getDashboardDate } from "../utils/dashboardUtils";
import { buildPotentialExcess, getConsumptionWindow } from "../utils/potentialExcessUtils";
import { synchronizeIngredientExpiry } from "./ingredientExpiryService";

async function getRecords(client, table, columns, configure = (query) => query) {
  if (!client) throw new Error("Supabase is not configured.");
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const query = configure(client.from(table).select(columns).order("id", { ascending: true }));
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export function getWeeklyStockMovements(client, asOfDate) {
  const { consumptionStartDate } = getConsumptionWindow(asOfDate);
  return getRecords(client, "stock_movements", "id,ingredient_id,adjustment,reason,created_at", (query) => query
    .gte("created_at", `${consumptionStartDate}T00:00:00+08:00`)
    .lt("created_at", `${asOfDate}T00:00:00+08:00`)
    .lt("adjustment", 0)
    .ilike("reason", "Order % completed"));
}

export function createPotentialExcessService(client) {
  return {
    async getEstimate(now = new Date()) {
      await synchronizeIngredientExpiry(client, now);
      const asOfDate = getDashboardDate(now);
      const [ingredients, stockMovements] = await Promise.all([
        getRecords(client, "ingredients", "*"),
        getWeeklyStockMovements(client, asOfDate),
      ]);
      return buildPotentialExcess({ ingredients: ingredients.filter((row) => !row.archived_at).map(normalizeIngredient), stockMovements, asOfDate }, Infinity);
    },
  };
}

export const potentialExcessService = createPotentialExcessService(supabase);
