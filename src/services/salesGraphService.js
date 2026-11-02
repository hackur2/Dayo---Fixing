import { supabase } from "../lib/supabase";
import { buildSalesReport } from "../utils/salesReportUtils";

export function createSalesGraphService(client) {
  async function getAll(table, columns, orderBy = ["id"], configure = (query) => query) {
    if (!client) throw new Error("Supabase is not configured.");
    const records = [];
    for (let offset = 0; ; offset += 1000) {
      let query = configure(client.from(table).select(columns));
      for (const key of orderBy) query = query.order(key);
      const { data, error } = await query.range(offset, offset + 999);
      if (error) throw error;
      const page = data ?? [];
      records.push(...page);
      if (page.length < 1000) return records;
    }
  }
  async function getOrders(startDate, endDate) {
    return getAll("orders", "id,status,created_at,order_items(menu_item_id,item_name,quantity,subtotal)", ["created_at", "id"], (query) => {
    query = query.eq("status", "Completed");
    if (startDate) query = query.gte("created_at", `${startDate}T00:00:00+08:00`);
    if (endDate) {
      const nextDay = new Date(`${endDate}T00:00:00Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      query = query.lt("created_at", `${nextDay.toISOString().slice(0, 10)}T00:00:00+08:00`);
    }
    return query;
    });
  }

  return {
    async getSalesGraph(startDate, endDate) {
      return buildSalesReport(await getOrders(startDate, endDate), [], []).dailySales;
    },
    async getSalesReport(startDate, endDate) {
      if (!client) throw new Error("Supabase is not configured.");
      const [orders, menu, categories, ingredients, recipes, combos] = await Promise.all([
        getOrders(startDate, endDate),
        getAll("menu_items", "id,name,is_active,category_id,subcategory_id"),
        getAll("menu_categories", "id,name,parent_id"),
        getAll("ingredients", "*"),
        getAll("menu_item_ingredients", "menu_item_id,ingredient_id,quantity", ["menu_item_id", "ingredient_id"]),
        getAll("combo_components", "combo_menu_item_id,component_menu_item_id,quantity", ["combo_menu_item_id", "component_menu_item_id"]),
      ]);
      return buildSalesReport(orders, menu, categories, { ingredients, recipes, combos });
    },
  };
}

export const salesGraphService = createSalesGraphService(supabase);

// Share concurrent requests within one mounted page, while allowing each chart
// to choose its own range and fetching fresh data on subsequent requests.
export function createSalesReportLoader(service = salesGraphService) {
  const pending = new Map();
  return (startDate, endDate) => {
    const key = JSON.stringify([startDate, endDate]);
    if (!pending.has(key)) {
      const request = Promise.resolve().then(() => service.getSalesReport(startDate, endDate))
        .finally(() => pending.delete(key));
      pending.set(key, request);
    }
    return pending.get(key);
  };
}
