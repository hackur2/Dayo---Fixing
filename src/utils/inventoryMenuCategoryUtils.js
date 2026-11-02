function categoryName(category) {
  return category.name.trim();
}

export function getInventoryMenuCategoryNavigation(mainCategories, subCategories, menuItems) {
  const drinkCategories = mainCategories.filter((category) => /^drinks?$/i.test(categoryName(category)));
  const drinkIds = drinkCategories.map((category) => category.id);
  const foodCategories = mainCategories.filter((category) => !drinkIds.includes(category.id));
  const foodIds = foodCategories.map((category) => category.id);

  const countItems = (ids) => menuItems.filter((item) => ids.includes(item.mainCategoryId)).length;
  return {
    groups: [
      { id: "all", name: "All Menu", description: "All menu records", count: menuItems.length, mainCategoryIds: null },
      { id: "foods", name: "Foods", description: "Meals, noodles, add-ons, sandwiches and soup", count: countItems(foodIds), mainCategoryIds: foodIds },
      { id: "drinks", name: "Drink", description: "Tea and iced coffee", count: countItems(drinkIds), mainCategoryIds: drinkIds },
    ],
    foods: foodCategories.map((category) => ({
      ...category,
      name: categoryName(category),
      count: countItems([category.id]),
    })),
    drinks: subCategories
      .filter((category) => drinkIds.includes(category.mainCategoryId)
        && ["tea", "iced coffee"].includes(categoryName(category).toLowerCase()))
      .map((category) => ({
        ...category,
        name: categoryName(category),
        count: menuItems.filter((item) => item.mainCategoryId === category.mainCategoryId && item.subCategoryId === category.id).length,
      })),
  };
}
