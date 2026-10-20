import { supabase } from "../lib/supabase";

export const salesGraphService = {
  async getSalesGraph(startDate, endDate) {
    let query = supabase.from("orders").select("created_at,order_items(subtotal)").eq("status", "Completed").order("created_at");
    if (startDate) query = query.gte("created_at", `${startDate}T00:00:00`);
    if (endDate) query = query.lt("created_at", `${endDate}T23:59:59.999`);
    const { data, error } = await query;
    if (error) throw error;
    const grouped = new Map();
    for (const order of data) {
      const date = order.created_at.slice(0, 10);
      const row = grouped.get(date) || { date, totalSales: 0, totalOrders: 0 };
      row.totalSales += order.order_items.reduce((sum, item) => sum + Number(item.subtotal), 0);
      row.totalOrders += 1; grouped.set(date, row);
    }
    return [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date));
  },
};
