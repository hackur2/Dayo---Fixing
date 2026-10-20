import { supabase } from "../lib/supabase";

function throwIfError(error) { if (error) throw error; }

export const inventoryService = {
  async getIngredients() {
    const { data, error } = await supabase.from("ingredients").select("*").order("name");
    throwIfError(error); return data;
  },
  async getMainCategories() {
    const { data, error } = await supabase.from("menu_categories").select("id,name,description").is("parent_id", null).eq("is_active", true).order("sort_order");
    throwIfError(error); return data;
  },
  async getSubCategories() {
    const { data, error } = await supabase.from("menu_categories").select("id,name,parent_id").not("parent_id", "is", null).eq("is_active", true).order("sort_order");
    throwIfError(error); return data.map((row) => ({ id: row.id, name: row.name, mainCategoryId: row.parent_id }));
  },
  async getMenuItems() {
    // Include archived rows so Admin can permanently delete old catalog entries.
    const { data, error } = await supabase.from("menu_items").select("*, menu_item_ingredients(ingredient_id,quantity), menu_item_variants(id,variant_key,name,price,sort_order)").order("name");
    throwIfError(error);
    return data.map((row) => ({ ...row, mainCategoryId: row.category_id, subCategoryId: row.subcategory_id,
      type: row.item_type, imageUrl: row.image_url, ingredientRequirements: row.menu_item_ingredients.map((x) => ({ ingredientId: x.ingredient_id, quantity: x.quantity })), variants: row.menu_item_variants || [] }));
  },
  async createSubCategory(payload) {
    const { data, error } = await supabase.from("menu_categories").insert({ parent_id: payload.mainCategoryId, name: payload.name }).select("id,name,parent_id").single();
    throwIfError(error); return { id: data.id, name: data.name, mainCategoryId: data.parent_id };
  },
  async createIngredient(payload) {
    const { data, error } = await supabase.from("ingredients").insert({ name: payload.name, category: payload.category,
      unit: payload.unit, current_stock: payload.currentStock, reorder_level: payload.reorderLevel, expires_on: payload.expiresOn }).select("*").single();
    throwIfError(error); return data;
  },
  async createMenuItem(payload) {
    const { data: row, error } = await supabase.from("menu_items").insert({ name: payload.name, item_type: "Ala Carte",
      category_id: payload.mainCategoryId, subcategory_id: payload.subCategoryId || null, price: payload.price,
      image_url: payload.imageUrl, is_active: true, is_available: true }).select("*").single();
    throwIfError(error);
    if (payload.ingredientRequirements.length) {
      const { error: recipeError } = await supabase.from("menu_item_ingredients").insert(payload.ingredientRequirements.map((item) => ({ menu_item_id: row.id, ingredient_id: item.ingredientId, quantity: item.quantity })));
      throwIfError(recipeError);
    }
    let variants = [];
    if (payload.variants?.length) {
      const { data: variantRows, error: variantsError } = await supabase
        .from("menu_item_variants")
        .insert(payload.variants.map((variant, index) => ({
          menu_item_id: row.id,
          variant_key: variant.variantKey,
          name: variant.name,
          price: variant.price,
          sort_order: variant.sortOrder ?? index,
        })))
        .select("id,menu_item_id,variant_key,name,price,sort_order");
      throwIfError(variantsError);
      variants = variantRows || [];
    }
    return { ...row, mainCategoryId: row.category_id, subCategoryId: row.subcategory_id, type: row.item_type, imageUrl: row.image_url, ingredientRequirements: payload.ingredientRequirements, variants };
  },
  async createComboItem(payload) {
    const [{ data: first, error: firstError }, { data: second, error: secondError }] = await Promise.all([
      supabase.from("menu_items").select("name,category_id,subcategory_id").eq("id", payload.firstItemId).single(),
      supabase.from("menu_items").select("name,category_id,subcategory_id").eq("id", payload.secondItemId).single(),
    ]);
    throwIfError(firstError); throwIfError(secondError);
    const { data: row, error } = await supabase.from("menu_items").insert({ name: `${first.name} + ${second.name}`,
      item_type: "Combo", category_id: first.category_id, subcategory_id: first.subcategory_id,
      price: payload.price, image_url: payload.imageUrl, is_active: true, is_available: true }).select("*").single();
    throwIfError(error);
    const { error: componentsError } = await supabase.from("combo_components").insert([
      { combo_menu_item_id: row.id, component_menu_item_id: payload.firstItemId },
      { combo_menu_item_id: row.id, component_menu_item_id: payload.secondItemId },
    ]);
    throwIfError(componentsError); return row;
  },
  async updateIngredientStock(ingredientId, { adjustmentAmount }) {
    const { data: current, error: readError } = await supabase.from("ingredients").select("current_stock").eq("id", ingredientId).single();
    throwIfError(readError);
    const nextStock = Number(current.current_stock) + Number(adjustmentAmount);
    if (nextStock < 0) throw new Error("Stock cannot be negative.");
    const { data, error } = await supabase.from("ingredients").update({ current_stock: nextStock }).eq("id", ingredientId).select("*").single();
    throwIfError(error);
    const { error: movementError } = await supabase.from("stock_movements").insert({ ingredient_id: ingredientId, adjustment: adjustmentAmount, reason: "Manual stock adjustment" });
    throwIfError(movementError); return data;
  },
  async updateIngredient(id, payload) {
    const { data: current, error: readError } = await supabase.from("ingredients").select("current_stock").eq("id", id).single();
    throwIfError(readError);
    const { data, error } = await supabase.from("ingredients").update({ name: payload.name, category: payload.category,
      unit: payload.unit, current_stock: payload.currentStock, reorder_level: payload.reorderLevel, expires_on: payload.expiresOn || null }).eq("id", id).select("*").single();
    throwIfError(error);
    const delta = Number(payload.currentStock) - Number(current.current_stock);
    if (delta) {
      const { error: movementError } = await supabase.from("stock_movements").insert({ ingredient_id: id, adjustment: delta, reason: "Inventory record edit" });
      throwIfError(movementError);
    }
    return data;
  },
  async updateMenuItem(id, payload) {
    const { data, error } = await supabase.from("menu_items").update({ name: payload.name, category_id: payload.mainCategoryId,
      subcategory_id: payload.subCategoryId || null, price: payload.price, image_url: payload.imageUrl }).eq("id", id).select("*").single();
    throwIfError(error);
    const { error: deleteError } = await supabase.from("menu_item_ingredients").delete().eq("menu_item_id", id);
    throwIfError(deleteError);
    if (payload.ingredientRequirements?.length) {
      const { error: recipeError } = await supabase.from("menu_item_ingredients").insert(payload.ingredientRequirements.map((item) => ({ menu_item_id: id, ingredient_id: item.ingredientId, quantity: item.quantity })));
      throwIfError(recipeError);
    }
    let savedVariants = payload.variants || [];
    if (Array.isArray(payload.variants)) {
      if (payload.variants.length) {
        const { data: existingVariants, error: readVariantsError } = await supabase
          .from("menu_item_variants")
          .select("id,menu_item_id,variant_key,name,price,sort_order")
          .eq("menu_item_id", id);
        throwIfError(readVariantsError);

        const existingById = new Map((existingVariants || []).map((variant) => [String(variant.id), variant]));
        const existingByKey = new Map((existingVariants || []).map((variant) => [variant.variant_key, variant]));
        savedVariants = [];

        for (const [index, variant] of payload.variants.entries()) {
          // Prefer matching the unique item/key pair so a row still updates
          // correctly when its id was not included in the edit form payload.
          const existing = existingByKey.get(variant.variantKey)
            || (variant.id ? existingById.get(String(variant.id)) : null);
          const row = {
            menu_item_id: id,
            variant_key: variant.variantKey,
            name: variant.name,
            price: Number(variant.price),
            sort_order: index,
          };
          const query = existing
            ? supabase.from("menu_item_variants").update(row).eq("id", existing.id).eq("menu_item_id", id)
            : supabase.from("menu_item_variants").insert(row);
          const { data: savedVariant, error: saveVariantError } = await query
            .select("id,menu_item_id,variant_key,name,price,sort_order")
            .single();
          throwIfError(saveVariantError);
          savedVariants.push(savedVariant);
        }

        const savedIds = savedVariants.map((variant) => variant.id);
        const deleteQuery = supabase.from("menu_item_variants").delete().eq("menu_item_id", id);
        const { error: staleVariantsError } = savedIds.length
          ? await deleteQuery.not("id", "in", `(${savedIds.join(",")})`)
          : await deleteQuery;
        throwIfError(staleVariantsError);
      } else {
        const { error: variantsError } = await supabase
          .from("menu_item_variants")
          .delete()
          .eq("menu_item_id", id);
        throwIfError(variantsError);
      }
    }
    return { ...data, mainCategoryId: data.category_id, subCategoryId: data.subcategory_id, type: data.item_type,
      imageUrl: data.image_url, ingredientRequirements: payload.ingredientRequirements || [], variants: savedVariants };
  },
  async deleteMenuItem(id) {
    const { data: comboReferences, error: referenceError } = await supabase
      .from("combo_components")
      .select("combo_menu_item_id")
      .eq("component_menu_item_id", id)
      .limit(1);
    throwIfError(referenceError);
    if (comboReferences?.length) {
      throw new Error("This menu item is used in a combo. Remove that combo first, then delete this item.");
    }

    // This is a permanent delete. Order item snapshots remain because their
    // foreign key is ON DELETE SET NULL; recipe/variant links cascade away.
    const { data, error } = await supabase.from("menu_items").delete().eq("id", id).select("id");
    throwIfError(error);
    if (!data?.length) throw new Error("Menu item was not deleted. Check your account permissions and try again.");
  },
  async deleteIngredient(id) {
    const [{ data: recipes, error: recipeError }, { data: movements, error: movementError }] = await Promise.all([
      supabase.from("menu_item_ingredients").select("menu_item_id").eq("ingredient_id", id).limit(1),
      supabase.from("stock_movements").select("id").eq("ingredient_id", id).limit(1),
    ]);
    throwIfError(recipeError);
    throwIfError(movementError);
    if (recipes?.length) throw new Error("This ingredient is used in a menu recipe. Remove it from the recipe before deleting it.");
    if (movements?.length) throw new Error("This ingredient has stock movement history and cannot be deleted.");

    const { data, error } = await supabase.from("ingredients").delete().eq("id", id).select("id");
    throwIfError(error);
    if (!data?.length) throw new Error("Ingredient was not deleted. Check your account permissions and try again.");
  },
};
