import assert from "node:assert/strict";
import test from "node:test";

import { getInventoryMenuCategoryNavigation } from "../src/utils/inventoryMenuCategoryUtils.js";

const mainCategories = [
  { id: "1", name: "Student Meals" },
  { id: "2", name: "Fried Noodles" },
  { id: "3", name: "Add-ons" },
  { id: "4", name: "Sandwich" },
  { id: "5", name: " Soup" },
  { id: "6", name: "Drinks" },
];
const subCategories = [
  { id: "22", mainCategoryId: "1", name: "Rice Meals" },
  { id: "23", mainCategoryId: "6", name: "Tea" },
  { id: "24", mainCategoryId: "6", name: "Hot Coffee" },
  { id: "28", mainCategoryId: "6", name: "Iced Coffee" },
];
const menuItems = [
  { id: 1, mainCategoryId: "1", subCategoryId: "22" },
  { id: 2, mainCategoryId: "1", subCategoryId: "27" },
  ...["2", "3", "4", "5"].map((id) => ({ id: Number(id) + 1, mainCategoryId: id })),
  { id: 7, mainCategoryId: "6", subCategoryId: "23" },
  { id: 8, mainCategoryId: "6", subCategoryId: "28" },
  { id: 9, mainCategoryId: "6", subCategoryId: "24" },
  { id: 10, mainCategoryId: "", subCategoryId: "" },
];

test("top groups aggregate existing menu records without losing uncategorized items from All Menu", () => {
  const { groups, foods, drinks } = getInventoryMenuCategoryNavigation(mainCategories, subCategories, menuItems);
  assert.deepEqual(groups.map(({ name, count }) => [name, count]), [["All Menu", 10], ["Foods", 6], ["Drink", 3]]);
  assert.deepEqual(foods.map(({ name }) => name), ["Student Meals", "Fried Noodles", "Add-ons", "Sandwich", "Soup"]);
  assert.equal(foods[0].count, 2);
  assert.deepEqual(drinks.map(({ name, count }) => [name, count]), [["Tea", 1], ["Iced Coffee", 1]]);
  assert.equal(mainCategories[4].name, " Soup");
});

test("drink cards use both parent and subcategory so unrelated records are not counted", () => {
  const unrelatedItem = { id: 11, mainCategoryId: "1", subCategoryId: "23" };
  const { drinks } = getInventoryMenuCategoryNavigation(mainCategories, subCategories, [...menuItems, unrelatedItem]);
  assert.equal(drinks.find((category) => category.name === "Tea").count, 1);
});

test("empty categories retain their cards and all counts remain zero", () => {
  const { groups, foods, drinks } = getInventoryMenuCategoryNavigation(mainCategories, subCategories, []);
  assert.deepEqual(groups.map((group) => group.count), [0, 0, 0]);
  assert.equal(foods.length, 5);
  assert.equal(drinks.length, 2);
  assert.equal([...foods, ...drinks].every((category) => category.count === 0), true);
});

test("Drink grouping accepts the singular label and surrounding whitespace", () => {
  const categories = mainCategories.map((category) => category.id === "6" ? { ...category, name: " Drink " } : category);
  const { groups, foods } = getInventoryMenuCategoryNavigation(categories, subCategories, menuItems);
  assert.equal(groups[2].count, 3);
  assert.equal(foods.some((category) => category.id === "6"), false);
});
