import { INGREDIENT_UNIT_OPTIONS } from "../constants/inventory.js";

// Only equivalent names are normalized here. kg and L require quantities,
// recipes, ledger history, and costs to be converted together in the database.
export function normalizeIngredientUnit(unit) {
  const value = String(unit ?? "").trim();
  switch (value.toLowerCase()) {
    case "pc": case "pcs": case "piece": case "pieces": return "Pcs";
    case "g": case "gram": case "grams": return "Grams";
    case "ml": case "milliliter": case "milliliters": case "millilitre": case "millilitres": return "mL";
    default: return value;
  }
}

export function isIngredientUnit(unit) {
  return INGREDIENT_UNIT_OPTIONS.includes(unit);
}

export function requireIngredientUnit(unit) {
  if (!isIngredientUnit(unit)) throw new Error("Select a Unit of Measure: Pcs, Grams, or mL.");
  return unit;
}

export function assertIngredientUnitChange(previousUnit, nextUnit, canChangeEmptyIngredient = false) {
  if (normalizeIngredientUnit(previousUnit) !== nextUnit && !canChangeEmptyIngredient) {
    throw new Error("The existing stock, recipes, and sales history must use the same unit. Convert this ingredient's quantities before changing its Unit of Measure.");
  }
}
