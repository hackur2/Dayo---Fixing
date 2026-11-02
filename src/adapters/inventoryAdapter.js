import { normalizeIngredientUnit, requireIngredientUnit } from "../utils/ingredientUnitUtils.js";

function normalizeDateOnly(value) {
  if (!value) return "";

  const stringValue = String(value);
  const dateMatch = stringValue.match(/^(\d{4}-\d{2}-\d{2})/);

  return dateMatch ? dateMatch[1] : stringValue;
}

function getValue(object, camelCaseKey, snakeCaseKey, fallbackValue = "") {
  return object?.[camelCaseKey] ?? object?.[snakeCaseKey] ?? fallbackValue;
}

export function normalizeIngredient(item) {
  const unitCost = item.unitCost ?? item.unit_cost;
  return {
    id: item.id,
    archivedAt: item.archived_at ?? null,
    name: item.name ?? "Unnamed Ingredient",
    category: item.category ?? "Food Ingredient",
    currentStock: Number(
      item.currentStock ?? item.current_stock ?? item.stock ?? 0
    ),
    reorderLevel: Number(
      item.reorderLevel ?? item.reorder_level ?? item.minimumStock ?? 0
    ),
    quantitySold30Days: Number(item.quantitySold30Days ?? item.quantity_sold_30_days ?? 0),
    averageDailySales: Number(item.averageDailySales ?? item.average_daily_sales ?? 0),
    safetyStock: Number(item.safetyStock ?? item.safety_stock ?? 0),
    reorderPoint: Number(item.reorderPoint ?? item.reorder_point ?? item.reorderLevel ?? item.reorder_level ?? 0),
    reorderPeriodStart: item.reorderPeriodStart ?? item.reorder_period_start ?? "",
    reorderPeriodEnd: item.reorderPeriodEnd ?? item.reorder_period_end ?? "",
    unit: normalizeIngredientUnit(item.unit ?? item.unitOfMeasure ?? item.unit_of_measure ?? "Pcs"),
    unitCost: unitCost == null || unitCost === "" ? null : Number(unitCost),
    expiresOn: normalizeDateOnly(
      item.expiresOn ??
        item.expires_on ??
        item.expirationDate ??
        item.expiration_date ??
        ""
    ),
    lastUpdated:
      item.lastUpdated ??
      item.last_updated ??
      item.updatedAt ??
      item.updated_at ??
      new Date().toLocaleString(),
  };
}

export function normalizeMainCategory(category) {
  return {
    id: String(category.id),
    name: category.name ?? "Unnamed Category",
    description: category.description ?? "",
  };
}

export function normalizeSubCategory(subCategory) {
  return {
    id: String(subCategory.id),
    mainCategoryId: String(
      getValue(subCategory, "mainCategoryId", "main_category_id", "")
    ),
    name: subCategory.name ?? "Unnamed Subcategory",
  };
}

export function normalizeInventoryMenuItem(item) {
  const rawRequirements =
    item.ingredientRequirements ??
    item.ingredient_requirements ??
    item.ingredients ??
    [];

  return {
    id: item.id,
    name: item.name ?? "Unnamed Menu Item",
    type: item.type ?? "Ala Carte",
    mainCategoryId: String(
      getValue(item, "mainCategoryId", "main_category_id", "")
    ),
    subCategoryId: String(
      getValue(item, "subCategoryId", "sub_category_id", "")
    ),
    price: Number(item.price ?? 0),
    variants: Array.isArray(item.variants)
      ? item.variants.map((variant) => ({
          id: variant.id,
          variantKey: variant.variantKey ?? variant.variant_key ?? "",
          name: variant.name ?? "",
          price: Number(variant.price ?? 0),
          sortOrder: Number(variant.sortOrder ?? variant.sort_order ?? 0),
        }))
      : [],
    imageUrl: getValue(item, "imageUrl", "image_url", ""),
    isAvailable: getValue(item, "isAvailable", "is_available", true),
    ingredientRequirements: Array.isArray(rawRequirements)
      ? rawRequirements.map((requirement) => ({
          ingredientId: Number(
            requirement.ingredientId ?? requirement.ingredient_id
          ),
          quantity: Number(requirement.quantity ?? 0),
        }))
      : [],
  };
}

function normalizeArray(data, possibleKeys, normalizeFunction) {
  const rawItems = Array.isArray(data)
    ? data
    : possibleKeys.reduce((result, key) => result || data?.[key], null) || [];

  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems.map(normalizeFunction);
}

export function normalizeIngredients(data) {
  return normalizeArray(
    data,
    ["ingredients", "items", "data"],
    normalizeIngredient
  );
}

export function normalizeMainCategories(data) {
  return normalizeArray(
    data,
    ["mainCategories", "main_categories", "categories", "data"],
    normalizeMainCategory
  );
}

export function normalizeSubCategories(data) {
  return normalizeArray(
    data,
    ["subCategories", "sub_categories", "data"],
    normalizeSubCategory
  );
}

export function normalizeInventoryMenuItems(data) {
  return normalizeArray(
    data,
    ["menuItems", "menu_items", "items", "data"],
    normalizeInventoryMenuItem
  );
}

export function createSubCategoryPayload(subcategoryForm) {
  return {
    mainCategoryId: subcategoryForm.mainCategoryId,
    name: subcategoryForm.name.trim(),
  };
}

export function createIngredientPayload(ingredientForm) {
  return {
    name: ingredientForm.name.trim(),
    category: ingredientForm.category,
    unit: requireIngredientUnit(ingredientForm.unit),
    currentStock: Number(ingredientForm.currentStock),
    reorderLevel: 0,
    unitCost: ingredientForm.unitCost === "" || ingredientForm.unitCost == null ? null : Number(ingredientForm.unitCost),
    expiresOn: ingredientForm.expiresOn || null,
  };
}

export function createAlaCartePayload(alaCarteForm) {
  const variants = (alaCarteForm.variants || []).map((variant, index) => ({
    variantKey: variant.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ""),
    name: variant.name.trim(),
    price: Number(variant.price),
    sortOrder: index,
  }));

  return {
    name: alaCarteForm.name.trim(),
    type: "Ala Carte",
    mainCategoryId: alaCarteForm.mainCategoryId,
    subCategoryId: alaCarteForm.subCategoryId,
    price: variants.length
      ? Math.min(...variants.map((variant) => variant.price))
      : Number(alaCarteForm.price),
    variants,
    imageUrl: alaCarteForm.imageUrl || "",
    ingredientRequirements: alaCarteForm.ingredientRequirements.map(
      (requirement) => ({
        ingredientId: Number(requirement.ingredientId),
        quantity: Number(requirement.quantity),
      })
    ),
  };
}

export function createComboPayload(comboForm) {
  return {
    firstItemId: Number(comboForm.firstItemId),
    secondItemId: Number(comboForm.secondItemId),
    price: Number(comboForm.price),
    imageUrl: comboForm.imageUrl || "",
  };
}
