import { supabase } from "../lib/supabase";

async function getSupabaseMenuItems() {
  const { data, error } = await supabase.rpc("get_customer_menu");
  if (error) throw error;

  return (data || []).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    brand: item.brand,
    mainCategory: item.main_category || "Uncategorized",
    subCategory: item.sub_category || "Uncategorized",
    price: item.price,
    available: item.available,
    isAvailable: item.is_available,
    isFeatured: item.is_featured,
    imageUrl: item.image_url,
    variants: (item.variants || []).map((variant) => ({
      id: variant.variant_key || String(variant.id),
      name: variant.name,
      price: variant.price,
    })),
  }));
}

export const menuService = {
  async getExpiringIngredientMenuContext(menuItems, today = new Date()) {
    const itemIds = menuItems.map((item) => item.id).filter(Boolean);
    if (!itemIds.length) return [];

    const [{ data: recipeRows, error: recipeError }, { data: ingredientRows, error: ingredientError }] = await Promise.all([
      supabase.from("menu_item_ingredients").select("menu_item_id,ingredient_id,quantity").in("menu_item_id", itemIds),
      supabase.from("ingredients").select("id,name,current_stock,expires_on"),
    ]);
    if (recipeError) throw recipeError;
    if (ingredientError) throw ingredientError;

    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const ingredientById = new Map((ingredientRows || []).map((ingredient) => [String(ingredient.id), ingredient]));
    const expiringByMenuItem = new Map();
    for (const recipe of recipeRows || []) {
      const ingredient = ingredientById.get(String(recipe.ingredient_id));
      if (!ingredient || Number(ingredient.current_stock) < Number(recipe.quantity)) continue;
      const expiry = new Date(`${ingredient.expires_on || ""}T00:00:00`);
      const daysUntilExpiry = Math.ceil((expiry - start) / 86400000);
      if (!ingredient.expires_on || !Number.isFinite(expiry.getTime()) || daysUntilExpiry < 0 || daysUntilExpiry > 14) continue;
      const matches = expiringByMenuItem.get(String(recipe.menu_item_id)) || [];
      matches.push({ name: ingredient.name, daysUntilExpiry });
      expiringByMenuItem.set(String(recipe.menu_item_id), matches);
    }

    return menuItems.flatMap((item) => {
      const expiringIngredients = expiringByMenuItem.get(String(item.id));
      return expiringIngredients?.length ? [{ itemId: String(item.id), expiringIngredients }] : [];
    });
  },
  getMenuItems() {
    return getSupabaseMenuItems();
  },

  getMenuItemById(menuItemId) {
    return getSupabaseMenuItems().then((items) => items.find((item) => item.id === Number(menuItemId)) || null);
  },

  getMenuItemsByCategory(category) {
    return getSupabaseMenuItems().then((items) => items.filter((item) => item.mainCategory === category));
  },
};
