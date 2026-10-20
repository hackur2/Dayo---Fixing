import { supabase } from "../lib/supabase";

export const promoService = {
  async getActivePromotionItem() {
    const { data, error } = await supabase.from("promotions").select("menu_item_id,starts_at,ends_at,menu_items:menu_items!promotions_menu_item_id_fkey(*)")
      .eq("is_active", true).order("created_at", { ascending: false });
    if (error) throw error;
    const now = Date.now();
    const promo = data.find((entry) => (!entry.starts_at || new Date(entry.starts_at).getTime() <= now) && (!entry.ends_at || new Date(entry.ends_at).getTime() >= now));
    if (!promo?.menu_items) return null;
    const item = promo.menu_items;
    return { ...item, main_category: null, sub_category: null, image_url: item.image_url, available: item.stock_count };
  },
};
