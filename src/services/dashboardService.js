import { supabase } from "../lib/supabase";
import { normalizeIngredient } from "../adapters/inventoryAdapter";
import { getStockStatus } from "../utils/inventoryUtils";
import { buildShelfLifeSummary, getDashboardDate } from "../utils/dashboardUtils";
import { buildPotentialExcess } from "../utils/potentialExcessUtils";
import { getWeeklyStockMovements } from "./potentialExcessService";
import { synchronizeIngredientExpiry } from "./ingredientExpiryService";
import { getIngredientSales30Days } from "./ingredientReorderService";
import { applyIngredientReorderPoints } from "../utils/ingredientReorderUtils";
import { MANUAL_ORDER_SOURCE, normalizeOrderSource } from "../utils/orderUtils";

export function createDashboardService(client) {
  async function getAllRecords(table, columns) {
    const records = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const result = await client.from(table).select(columns)
        .order("id", { ascending: true }).range(offset, offset + pageSize - 1);
      if (result.error) throw result.error;
      const page = result.data ?? [];
      records.push(...page);
      if (page.length < pageSize) return { data: records };
    }
  }

  return {
    async getDashboardSummary(now = new Date()) {
      await synchronizeIngredientExpiry(client, now);
      const today = getDashboardDate(now);
      const results = await Promise.all([
        getAllRecords("orders", "id,status,source,created_at,order_items(menu_item_id,item_name,quantity,subtotal,recommendation_source)"),
        getAllRecords("ingredients", "*"),
        getWeeklyStockMovements(client, today),
        client.from("staff_shifts").select("id", { count: "exact", head: true }).eq("status", "On Duty"),
        getIngredientSales30Days(client, now),
      ]);

      for (const result of results) {
        if (result.error) throw result.error;
      }

      const [ordersResult, ingredientsResult, stockMovements, staffResult, ingredientSales] = results;
      const orders = ordersResult.data ?? [];
      const completedOrders = orders.filter((order) => order.status === "Completed");
      const ingredients = applyIngredientReorderPoints((ingredientsResult.data ?? []).filter((row) => !row.archived_at), ingredientSales, now).map(normalizeIngredient);
      const lowStockItems = ingredients.filter((item) => getStockStatus(item) === "Low Stock");
      const topItems = new Map();
      const dailyRevenue = new Map();
      const dailyActivity = new Map();
      let totalSales = 0;
      let todaySales = 0;

      for (const order of orders) {
        const date = getDashboardDate(order.created_at);
        if (date && order.status !== "Cancelled") {
          dailyActivity.set(date, (dailyActivity.get(date) ?? 0) + 1);
        }
      }

      for (const order of completedOrders) {
        const date = getDashboardDate(order.created_at);
        const dailyTotal = dailyRevenue.get(date) ?? { date, totalSales: 0, totalOrders: 0 };
        dailyTotal.totalOrders += 1;
        for (const item of order.order_items ?? []) {
          const revenue = Number(item.subtotal ?? 0);
          totalSales += revenue;
          dailyTotal.totalSales += revenue;
          if (date === today) todaySales += revenue;
          // Deleted menu items retain their order-time name and sales history.
          const key = item.menu_item_id ?? item.item_name;
          const row = topItems.get(key) ?? {
            id: key,
            name: item.item_name,
            quantitySold: 0,
            revenue: 0,
          };
          row.quantitySold += Number(item.quantity ?? 0);
          row.revenue += revenue;
          topItems.set(key, row);
        }
        if (date) dailyRevenue.set(date, dailyTotal);
      }

      return {
        asOfDate: today,
        ingredientCount: ingredients.length,
        shelfLife: buildShelfLifeSummary(ingredients, today),
        potentialExcess: buildPotentialExcess({ ingredients, stockMovements, asOfDate: today }),
        revenueTrend: [...dailyRevenue.values()].sort((a, b) => a.date.localeCompare(b.date)),
        customerActivity: [...dailyActivity].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
        totalSales,
        todaySales,
        totalOrders: orders.length,
        orderSources: ["QR Order", MANUAL_ORDER_SOURCE, "Sumo AI"].map((source) => ({
          source,
          count: orders.filter((order) => {
            const orderSource = (order.order_items ?? []).some((item) => item.recommendation_source === "Sumo AI")
              ? "Sumo AI"
              : normalizeOrderSource(order.source) || "QR Order";
            return orderSource === source;
          }).length,
        })),
        lowStockCount: lowStockItems.length,
        lowStockItems,
        activeStaffCount: staffResult.count ?? 0,
        orderPipeline: ["Pending", "Preparing", "Ready", "Completed", "Cancelled"].map((status) => ({
          status,
          count: orders.filter((order) => order.status === status).length,
        })),
        topSellingItems: [...topItems.values()]
          .sort((a, b) => b.quantitySold - a.quantitySold || b.revenue - a.revenue)
          .slice(0, 5),
      };
    },
  };
}

export const dashboardService = createDashboardService(supabase);
