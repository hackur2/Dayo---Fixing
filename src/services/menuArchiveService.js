import { supabase } from "../lib/supabase";

export function createMenuArchiveService(client) {
  async function readMenuItems(isActive) {
    const records = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.from("menu_items")
        .select("*, menu_item_ingredients(ingredient_id,quantity), menu_item_variants(id,variant_key,name,price,sort_order)")
        .eq("is_active", isActive).order("name").order("id").range(offset, offset + 999);
      if (error) throw error;
      const page = data ?? [];
      records.push(...page.map((row) => ({
        ...row, mainCategoryId: row.category_id, subCategoryId: row.subcategory_id,
        type: row.item_type, imageUrl: row.image_url, lastUpdated: row.updated_at,
        ingredientRequirements: (row.menu_item_ingredients ?? []).map((item) => ({ ingredientId: item.ingredient_id, quantity: item.quantity })),
        variants: row.menu_item_variants ?? [],
      })));
      if (page.length < 1000) return records;
    }
  }

  return {
    getActiveMenuItems: () => readMenuItems(true),
    getArchivedMenuItems: () => readMenuItems(false),
    async archiveMenuItem(id) {
      const { data: references, error: referenceError } = await client.from("combo_components")
        .select("combo_menu_item_id,combo:menu_items!combo_components_combo_menu_item_id_fkey!inner(is_active)")
        .eq("component_menu_item_id", id).eq("combo.is_active", true).limit(1);
      if (referenceError) throw referenceError;
      if (references?.length) {
        throw new Error("This menu item is used in an active combo. Archive that combo first, then archive this item.");
      }
      // Preserve the row, recipes, variants, combo links, and past order references.
      const { data, error } = await client.from("menu_items")
        .update({ is_active: false, is_available: false }).eq("id", id)
        .select("id,is_active").maybeSingle();
      if (error) throw error;
      if (!data || String(data.id) !== String(id) || data.is_active !== false) {
        throw new Error("Menu item was not archived. Refresh the page and check your account permissions.");
      }
    },
  };
}

export const menuArchiveService = createMenuArchiveService(supabase);
