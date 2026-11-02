import { getIngredientSalesTotals, getIngredientSalesWindow } from "../utils/ingredientReorderUtils.js";

export async function getIngredientSales30Days(client, now = new Date()) {
  if (!client) throw new Error("Supabase is not configured.");
  // Older databases can still calculate ROP from their existing stock ledger.
  // The SQL setup additionally maintains the saved threshold between app reads.
  const { error: refreshError } = await client.rpc("refresh_ingredient_reorder_points");
  if (refreshError && !["PGRST202", "42883"].includes(refreshError.code)) throw refreshError;
  const window = getIngredientSalesWindow(now);
  const records = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("stock_movements")
      .select("id,ingredient_id,adjustment,reason,created_at")
      .gte("created_at", window.start).lte("created_at", window.end)
      .lt("adjustment", 0).ilike("reason", "Order % completed")
      .order("id", { ascending: true }).range(offset, offset + 999);
    if (error) throw error;
    const page = data ?? [];
    records.push(...page);
    if (page.length < 1000) return getIngredientSalesTotals(records, now);
  }
}
