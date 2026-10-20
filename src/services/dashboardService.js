import { supabase } from "../lib/supabase";

export const dashboardService = {
  async getDashboardSummary() {
    const [ordersResult, ingredientsResult, menuResult, feedbackResult] = await Promise.all([
      supabase.from("orders").select("id,status,source,created_at,order_items(*)"),
      supabase.from("ingredients").select("id,name,current_stock,reorder_level,unit"),
      supabase.from("menu_items").select("id").eq("is_active", true),
      supabase.from("feedback").select("id"),
    ]);
    for (const result of [ordersResult, ingredientsResult, menuResult, feedbackResult]) if (result.error) throw result.error;
    const orders = ordersResult.data;
    const today = new Date().toISOString().slice(0, 10);
    const todaysOrders = orders.filter((order) => order.created_at.slice(0, 10) === today);
    const sales = todaysOrders.filter((order) => order.status === "Completed");
    const lowStockItems = ingredientsResult.data.filter((item) => Number(item.current_stock) <= Number(item.reorder_level)).map((item) => ({ id: item.id, name: item.name, currentStock: item.current_stock, reorderLevel: item.reorder_level, unit: item.unit }));
    const topItems = new Map();
    for (const order of sales) for (const item of order.order_items) {
      const row = topItems.get(item.menu_item_id) || { id: item.menu_item_id, name: item.item_name, quantitySold: 0, revenue: 0 };
      row.quantitySold += Number(item.quantity); row.revenue += Number(item.subtotal); topItems.set(item.menu_item_id, row);
    }
    const revenueTrend = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(); date.setDate(date.getDate() - 6 + i); const day = date.toISOString().slice(0, 10);
      const matching = orders.filter((order) => order.created_at.slice(0, 10) === day && order.status === "Completed");
      return { date: day, label: day.slice(5), totalSales: matching.reduce((sum, order) => sum + order.order_items.reduce((n, item) => n + Number(item.subtotal), 0), 0), totalOrders: matching.length };
    });
    return {
      totalSales: sales.reduce((sum, order) => sum + order.order_items.reduce((n, item) => n + Number(item.subtotal), 0), 0),
      ordersToday: todaysOrders.length, menuItemsCount: menuResult.data.length, feedbackCount: feedbackResult.data.length,
      lowStockCount: lowStockItems.length, lowStockItems, revenueTrend,
      orderSources: [
        {
          source: "QR Order",
          count: todaysOrders.filter((order) => order.source === "QR Order" && !hasSumoAiRecommendation(order)).length,
        },
        {
          source: "Manual POS",
          count: todaysOrders.filter((order) => order.source === "Manual POS").length,
        },
        {
          source: "Sumo AI",
          count: todaysOrders.filter((order) => order.source === "Sumo AI" || hasSumoAiRecommendation(order)).length,
        },
      ],
      orderPipeline: ["Pending", "Preparing", "Ready", "Completed"].map((status) => ({ status, count: todaysOrders.filter((order) => order.status === status).length })),
      topSellingItems: [...topItems.values()].sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 5),
    };
  },
};

function hasSumoAiRecommendation(order) {
  return (order.order_items || []).some((item) =>
    (item.recommendation_source ?? item.recommendationSource) === "Sumo AI"
  );
}
