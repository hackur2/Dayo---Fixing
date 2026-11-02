import { getStockStatus } from "./inventoryUtils.js";

function ingredientKey(name) {
  return String(name ?? "").trim().toLocaleLowerCase("en-PH");
}

export function getLowStockRows(ingredients, suppliers) {
  const suppliersByIngredient = new Map();
  for (const supplier of suppliers) {
    const key = ingredientKey(supplier.ingredient);
    if (!key) continue;
    const matches = suppliersByIngredient.get(key) ?? [];
    matches.push(supplier);
    suppliersByIngredient.set(key, matches);
  }

  return ingredients
    .filter((ingredient) => getStockStatus(ingredient) === "Low Stock")
    .map((ingredient) => ({
      ...ingredient,
      suppliers: suppliersByIngredient.get(ingredientKey(ingredient.name)) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en-PH", { sensitivity: "base" }));
}
