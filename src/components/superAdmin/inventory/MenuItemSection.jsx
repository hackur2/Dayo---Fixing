import { useMemo, useState } from "react";
import SortableHeader from "../../common/SortableHeader";
import { sortRecords } from "../../../utils/sortUtils";

import {
  getMenuItemAvailability,
  getStatusClassName,
} from "../../../utils/inventoryUtils";

function MenuItemSection({
  menuItems,
  ingredients,
  mainCategories,
  subCategories,
  onEditMenuItem,
  onDeleteMenuItem,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");

  function handleSortColumn(column) {
    setSortDirection((currentDirection) =>
      sortBy === column
        ? currentDirection === "asc" ? "desc" : "asc"
        : column === "date" ? "desc" : "asc"
    );
    setSortBy(column);
  }
  const [activeMainCategoryId, setActiveMainCategoryId] = useState("all");
  const [activeSubCategoryId, setActiveSubCategoryId] = useState("all");

  const mainCategoryCards = useMemo(() => {
    const allMenuCard = {
      id: "all",
      name: "All Menu",
      description: "All menu records",
      count: menuItems.length,
    };

    const categoryCards = mainCategories.map((category) => ({
      ...category,
      count: menuItems.filter(
        (item) => item.mainCategoryId === category.id
      ).length,
    }));

    return [allMenuCard, ...categoryCards];
  }, [mainCategories, menuItems]);

  const visibleSubCategories = useMemo(() => {
    if (activeMainCategoryId === "all") {
      return subCategories;
    }

    return subCategories.filter(
      (subCategory) => subCategory.mainCategoryId === activeMainCategoryId
    );
  }, [subCategories, activeMainCategoryId]);

  const filteredMenuItems = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    const matches = menuItems.filter((item) => {
      const matchesSearch =
        searchValue === "" || item.name.toLowerCase().includes(searchValue);

      const matchesMainCategory =
        activeMainCategoryId === "all" ||
        item.mainCategoryId === activeMainCategoryId;

      const matchesSubCategory =
        activeSubCategoryId === "all" ||
        item.subCategoryId === activeSubCategoryId;

      return matchesSearch && matchesMainCategory && matchesSubCategory;
    });

    const getters = {
      name: [(item) => item.name, "text"],
      type: [(item) => item.type, "text"],
      mainCategory: [
        (item) => mainCategories.find((category) => category.id === item.mainCategoryId)?.name || "Uncategorized",
        "text",
      ],
      subCategory: [
        (item) => subCategories.find((category) => category.id === item.subCategoryId)?.name || "Uncategorized",
        "text",
      ],
      price: [(item) => item.price, "number"],
      availability: [(item) => getMenuItemAvailability(item, ingredients), "text"],
    };
    const [getter, type] = getters[sortBy];
    return sortRecords(matches, getter, sortDirection, type);
  }, [menuItems, ingredients, mainCategories, subCategories, searchTerm, activeMainCategoryId, activeSubCategoryId, sortBy, sortDirection]);

  function getMainCategoryName(mainCategoryId) {
    return (
      mainCategories.find((category) => category.id === mainCategoryId)?.name ||
      "Uncategorized"
    );
  }

  function getSubCategoryName(subCategoryId) {
    return (
      subCategories.find((category) => category.id === subCategoryId)?.name ||
      "Uncategorized"
    );
  }

  function getIngredientName(ingredientId) {
    return (
      ingredients.find(
        (ingredient) => ingredient.id === Number(ingredientId)
      )?.name || "Unknown Ingredient"
    );
  }

  function getIngredientUnit(ingredientId) {
    return (
      ingredients.find(
        (ingredient) => ingredient.id === Number(ingredientId)
      )?.unit || "unit"
    );
  }

  function handleMainCategoryChange(categoryId) {
    setActiveMainCategoryId(categoryId);
    setActiveSubCategoryId("all");
  }

  return (
    <>
      <section className="inventory-menu-filter-card">
        <div className="inventory-menu-search-sort">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search menu item"
            aria-label="Search menu item"
            className="inventory-menu-search"
          />
        </div>

        <div className="menu-main-category-grid">
          {mainCategoryCards.map((category) => (
            <button
              key={category.id}
              type="button"
              className={
                activeMainCategoryId === category.id
                  ? "menu-main-category-card active"
                  : "menu-main-category-card"
              }
              onClick={() => handleMainCategoryChange(category.id)}
            >
              <span>{category.name.charAt(0)}</span>

              <div>
                <strong>{category.name}</strong>
                <p>{category.count} items</p>
                <small>{category.description}</small>
              </div>
            </button>
          ))}
        </div>

        <div className="menu-subcategory-pill-row">
          <button
            type="button"
            className={activeSubCategoryId === "all" ? "active" : ""}
            onClick={() => setActiveSubCategoryId("all")}
          >
            All Types
          </button>

          {visibleSubCategories.map((subCategory) => {
            const count = menuItems.filter(
              (item) => item.subCategoryId === subCategory.id
            ).length;

            return (
              <button
                key={subCategory.id}
                type="button"
                className={
                  activeSubCategoryId === subCategory.id ? "active" : ""
                }
                onClick={() => setActiveSubCategoryId(subCategory.id)}
              >
                {subCategory.name} {count}
              </button>
            );
          })}
        </div>
      </section>

      <section className="inventory-table-card">
        <div className="inventory-table-header">
          <div>
            <h2>Menu Items</h2>
            <p>
              Availability is based on whether all required ingredients are
              currently available.
            </p>
          </div>
        </div>

        {filteredMenuItems.length > 0 ? (
          <table className="inventory-table menu-inventory-table">
            <thead>
              <tr>
                <SortableHeader label="Menu Item" column="name" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <SortableHeader label="Type" column="type" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <SortableHeader label="Main Category" column="mainCategory" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <SortableHeader label="Subcategory" column="subCategory" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <th>Required Ingredients</th>
                <SortableHeader label="Price" column="price" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <SortableHeader label="Availability" column="availability" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredMenuItems.map((item) => {
                const availability = getMenuItemAvailability(item, ingredients);

                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>

                    <td>{item.type}</td>

                    <td>{getMainCategoryName(item.mainCategoryId)}</td>

                    <td>{getSubCategoryName(item.subCategoryId)}</td>

                    <td>
                      <div className="ingredient-requirement-list">
                        {item.ingredientRequirements.map((requirement) => (
                          <span
                            key={`${item.id}-${requirement.ingredientId}`}
                          >
                            {getIngredientName(requirement.ingredientId)} —{" "}
                            {requirement.quantity}{" "}
                            {getIngredientUnit(requirement.ingredientId)}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td>₱{item.price.toFixed(2)}</td>

                    <td>
                      <span
                        className={`menu-availability-badge ${getStatusClassName(
                          availability
                        )}`}
                      >
                        {availability}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="secondary-button inventory-small-button"
                        onClick={() => onEditMenuItem(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="secondary-button inventory-small-button inventory-delete-button"
                        onClick={() => onDeleteMenuItem(item)}
                        aria-label={`Delete ${item.name}`}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <section className="admin-empty-state">
            <h2>No menu items found</h2>
            <p>Try changing the search, main category, or subcategory.</p>
          </section>
        )}
      </section>
    </>
  );
}

export default MenuItemSection;
