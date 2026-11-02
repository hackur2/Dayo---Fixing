import assert from "node:assert/strict";
import test from "node:test";
import { normalizeIngredient } from "../src/adapters/inventoryAdapter.js";
import { assertIngredientUnitChange, normalizeIngredientUnit, requireIngredientUnit } from "../src/utils/ingredientUnitUtils.js";

test("equivalent unit names have one display spelling without scaling quantities", () => {
  for (const [unit, expected] of [["pcs","Pcs"],["pieces","Pcs"],["g","Grams"],["Grams","Grams"],["ML","mL"],[" millilitres ","mL"]]) {
    assert.equal(normalizeIngredientUnit(unit), expected);
    const row = normalizeIngredient({ unit, current_stock: 0.125, unit_cost: 0.002, reorder_level: 1 });
    assert.equal(row.unit, expected);
    assert.equal(row.currentStock, 0.125);
    assert.equal(row.unitCost, 0.002);
    assert.equal(row.reorderLevel, 1);
  }
  assert.equal(normalizeIngredientUnit("kg"), "kg");
  assert.equal(normalizeIngredientUnit("packs"), "packs");
});

test("saving requires an exact dropdown value and protects existing measurement history", () => {
  for (const unit of ["Pcs","Grams","mL"]) assert.equal(requireIngredientUnit(unit), unit);
  for (const unit of ["",null,undefined,"kg","grams","packs","Pcs "]) assert.throws(() => requireIngredientUnit(unit), /Select a Unit/);
  assert.doesNotThrow(() => assertIngredientUnitChange("grams","Grams"));
  assert.throws(() => assertIngredientUnitChange("kg","Grams"), /same unit/);
  assert.throws(() => assertIngredientUnitChange("Pcs","Grams"), /same unit/);
  assert.doesNotThrow(() => assertIngredientUnitChange("Pcs","Grams",true));
});
