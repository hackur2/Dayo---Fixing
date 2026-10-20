import { supabase } from "../lib/supabase";
import { getValidQrSession } from "../utils/qrSessionUtils";

function withItems(row) {
  if (!row) return null;
  return { ...row, items: (row.order_items || []).map((item) => ({
    id: item.id,
    menuItemId: item.menu_item_id,
    name: item.item_name,
    selectedVariantId: item.selected_variant_key,
    variantLabel: item.variant_label,
    recommendationSource: item.recommendation_source,
    price: item.unit_price,
    quantity: item.quantity,
    subtotal: item.subtotal,
  })), totalAmount: (row.order_items || []).reduce((total, item) => total + Number(item.subtotal), 0) };
}

async function getStaffOrder(orderNumber) {
  const { data, error } = await supabase.from("orders").select("*, order_items(*)").eq("order_number", orderNumber).single();
  if (error) throw error;
  return withItems(data);
}

export const orderService = {
  async createOrder(payload) {
    const { data, error } = await supabase.rpc("create_customer_order", {
      p_qr_token: payload.qrToken,
      p_customer_name: payload.customerName,
      p_order_type: payload.orderType,
      p_payment_method: payload.paymentMethod,
      p_payment_reference_number: payload.paymentReferenceNumber,
      p_notes: payload.notes,
      p_items: payload.items,
    });
    if (error) throw error;
    return data;
  },
  async cancelCustomerOrder(orderNumber) {
    const session = getValidQrSession();
    if (!session) throw new Error("Your QR access session expired. Scan the QR code again.");
    const { data, error } = await supabase.rpc("cancel_customer_order", {
      p_qr_token: session.qrToken,
      p_order_number: orderNumber,
    });
    if (error) throw error;
    return data;
  },
  async createManualOrder(payload) {
    const { data, error } = await supabase.rpc("create_manual_order", {
      p_customer_name: payload.customerName,
      p_order_type: payload.orderType,
      p_payment_method: payload.paymentMethod,
      p_payment_reference_number: payload.paymentReferenceNumber,
      p_notes: payload.notes,
      p_items: payload.items,
    });
    if (error) throw error;
    return data;
  },
  async getOrders(filters = {}) {
    let query = supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
    if (filters.status && filters.status !== "All") query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return data.map(withItems);
  },
  async getOrderByOrderNumber(orderNumber) {
    const session = getValidQrSession();
    if (session) {
      const { data, error } = await supabase.rpc("get_customer_order", { p_qr_token: session.qrToken, p_order_number: orderNumber });
      if (error) throw error;
      return data;
    }
    return getStaffOrder(orderNumber);
  },
  async getOrderStatusByOrderNumber(orderNumber) {
    const order = await this.getOrderByOrderNumber(orderNumber);
    return { orderNumber: order.orderNumber || order.order_number, status: order.status, updatedAt: order.updatedAt || order.updated_at };
  },
  async getKdsOrders() {
    const { data, error } = await supabase.from("orders").select("*, order_items(*)").in("status", ["Pending", "Preparing", "Ready"]).order("created_at");
    if (error) throw error;
    return data.map(withItems);
  },
  async updateOrderStatus(orderNumber, status) {
    const { data, error } = await supabase.from("orders").update({ status }).eq("order_number", orderNumber).select("order_number,status,updated_at").single();
    if (error) throw error;
    return { orderNumber: data.order_number, status: data.status, updatedAt: data.updated_at };
  },
  getOrderById(orderNumber) { return this.getOrderByOrderNumber(orderNumber); },
  getOrderStatus(orderNumber) { return this.getOrderStatusByOrderNumber(orderNumber); },
};
