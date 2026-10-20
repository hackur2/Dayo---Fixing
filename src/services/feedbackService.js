import { supabase } from "../lib/supabase";

export const feedbackService = {
  async submitCustomerFeedback(payload) {
    const { data, error } = await supabase.rpc("submit_customer_feedback", {
      p_qr_token: payload.qrToken,
      p_order_number: payload.orderNumber,
      p_rating: payload.rating,
      p_message: payload.comment,
    });
    if (error) throw error; return data;
  },
  async getCustomerFeedback() {
    const { data, error } = await supabase.from("feedback").select("*, orders:orders!feedback_order_id_fkey(order_number,customer_name)").order("created_at", { ascending: false });
    if (error) throw error;
    return data.map((row) => ({ id: row.id, orderNumber: row.orders?.order_number || "No Order Number",
      customerName: row.orders?.customer_name || "Customer", rating: row.rating, feedbackType: row.feedback_type,
      message: row.message, status: row.status, submittedDate: row.created_at.slice(0, 10),
      submittedTime: new Date(row.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) }));
  },
  async markFeedbackAsReviewed(feedbackId) {
    const { data, error } = await supabase.from("feedback").update({ status: "Reviewed", reviewed_at: new Date().toISOString() }).eq("id", feedbackId).select("*, orders:orders!feedback_order_id_fkey(order_number,customer_name)").single();
    if (error) throw error;
    return { id: data.id, orderNumber: data.orders?.order_number, customerName: data.orders?.customer_name,
      rating: data.rating, feedbackType: data.feedback_type, message: data.message, status: data.status,
      submittedDate: data.created_at.slice(0, 10), submittedTime: new Date(data.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) };
  },
};
