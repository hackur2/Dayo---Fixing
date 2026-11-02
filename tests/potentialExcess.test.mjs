import assert from "node:assert/strict";
import test from "node:test";
import { buildPotentialExcess, calculatePotentialExcess, getConsumptionWindow } from "../src/utils/potentialExcessUtils.js";

const asOfDate = "2026-10-29";
const ingredient = (id, currentStock = 20, expiresOn = "2026-11-05", unit = "pcs") => ({ id, name: `Ingredient ${id}`, currentStock, expiresOn, unit });
const movement = (ingredientId, adjustment, createdAt = "2026-10-28T04:00:00Z", reason = "Order DY-001 completed") => ({ ingredient_id: ingredientId, adjustment, created_at: createdAt, reason });
const estimate = (ingredients, stockMovements = [], limit = Infinity) => buildPotentialExcess({ ingredients, stockMovements, asOfDate }, limit);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} is not approximately ${expected}`);

test("the supplied formula uses daily consumption multiplied by the full remaining shelf life", () => {
  assert.equal(calculatePotentialExcess(100, 14, 3), 94);
  assert.equal(calculatePotentialExcess(20, 7, 14), 6);
  assert.equal(calculatePotentialExcess(10, 35, 7), 0);
  assert.equal(calculatePotentialExcess(10, 0, 30), 10);
  assert.equal(calculatePotentialExcess(10, 70, 0), 10);
  near(calculatePotentialExcess(100, 5, 2), 100 - 10 / 7);
  near(calculatePotentialExcess(0.3, 0.1, 7), 0.2);
});

test("weekly consumption includes exactly seven complete Philippine dates and excludes today", () => {
  const movements = [
    movement(1, -1, "2026-10-21T16:00:00Z"),
    movement(1, -6, "2026-10-28T15:59:59Z"),
    movement(1, -100, "2026-10-21T15:59:59Z"),
    movement(1, -100, "2026-10-28T16:00:00Z"),
    movement(1, -100, "2026-11-01T00:00:00Z"),
  ];
  const result = estimate([ingredient(1)], movements);
  assert.equal(result.consumptionStartDate, "2026-10-22");
  assert.equal(result.consumptionEndDate, "2026-10-28");
  assert.equal(result.items[0].weeklyConsumption, 7);
  assert.equal(result.items[0].potentialExcess, 13);
});

test("only completed-order deductions count as ingredient consumption", () => {
  const result = estimate([ingredient(1)], [
    movement("1", "-2.5"), movement(1, -0.5),
    movement(1, -100, undefined, "Inventory record edit"),
    movement(1, -100, undefined, "Manual stock adjustment"),
    movement(1, 100), movement(1, -100, undefined, "Order DY-002 preparing"),
    movement(null, -100), movement(1, "invalid"),
  ]).items[0];
  assert.equal(result.weeklyConsumption, 3);
  assert.equal(result.potentialExcess, 17);
});

test("remaining shelf life belongs to each ingredient and never becomes negative", () => {
  const rows = estimate([
    ingredient(1, 10, "2026-11-01"), ingredient(2, 10, "2026-10-30"),
    ingredient(3, 10, "2026-10-28"), ingredient(4, 10, asOfDate),
  ], [1, 2, 3, 4].map((id) => movement(id, -7))).items;
  assert.deepEqual([1, 2, 3, 4].map((id) => {
    const row = rows.find((item) => item.id === id);
    return [row.remainingShelfLife, row.potentialExcess, row.isExpired];
  }), [[3, 7, false], [1, 9, false], [0, 10, true], [0, 10, false]]);
});

test("missing and impossible expiry dates remain unavailable instead of appearing as zero excess", () => {
  for (const expiry of ["", "invalid", "2026-02-30"]) {
    const row = estimate([ingredient(1, 20, expiry)]).items[0];
    assert.equal(row.remainingShelfLife, null);
    assert.equal(row.potentialExcess, null);
    assert.equal(row.unavailableReason, "Expiry date needed");
  }
});

test("invalid stock cannot produce a fabricated estimate, while real zero stock stays zero", () => {
  for (const stock of [null, "", NaN, -1]) {
    const row = estimate([ingredient(1, stock)]).items[0];
    assert.equal(row.currentStock, null);
    assert.equal(row.potentialExcess, null);
  }
  assert.equal(estimate([ingredient(1, 0)]).items[0].potentialExcess, 0);
  assert.equal(calculatePotentialExcess(20, null, 7), null);
  assert.equal(calculatePotentialExcess(20, -1, 7), null);
});

test("ingredients retain their own units and shared recipe sales are not counted twice", () => {
  const rows = estimate([ingredient(1, 25, "2026-11-05", "kg"), ingredient(2, 500, "2026-11-05", "g")], [movement(1, -2), movement(1, -3), movement(2, -50)]).items;
  assert.equal(rows.find((row) => row.id === 1).unit, "kg");
  assert.equal(rows.find((row) => row.id === 1).weeklyConsumption, 5);
  assert.equal(rows.find((row) => row.id === 1).potentialExcess, 20);
  assert.equal(rows.find((row) => row.id === 2).potentialExcess, 450);
});

test("zero recorded consumption leaves current stock as potential excess", () => {
  const row = estimate([ingredient(1, 12.5, "2027-01-01", "L")]).items[0];
  assert.equal(row.weeklyConsumption, 0);
  assert.equal(row.potentialExcess, 12.5);
});

test("top-three cards and the full list use the same sorted ingredient estimates without mutating inputs", () => {
  const ingredients = [ingredient(1, 10), ingredient(2, 30), ingredient(3, 20), ingredient(4, 40), ingredient(5, 50, "")];
  const original = structuredClone(ingredients);
  const all = estimate(ingredients).items;
  assert.deepEqual(all.map((row) => row.id), [4, 2, 3, 1, 5]);
  assert.deepEqual(estimate(ingredients, [], 3).items, all.slice(0, 3));
  assert.deepEqual(ingredients, original);
  assert.deepEqual(estimate([]).items, []);
});

test("date windows cross years and reject invalid as-of dates", () => {
  const window = getConsumptionWindow("2027-01-02");
  assert.equal(window.consumptionStartDate, "2026-12-26");
  assert.equal(window.consumptionEndDate, "2027-01-01");
  for (const value of ["", "bad", "2026-02-30"]) assert.throws(() => getConsumptionWindow(value), /valid date/);
});
