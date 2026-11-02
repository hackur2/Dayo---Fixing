import { useId, useMemo, useState } from "react";
import SortableHeader from "../../common/SortableHeader";
import { sortRecords } from "../../../utils/sortUtils";
import { useInventorySelection } from "../../../hooks/useInventorySelection";
import { usePagination } from "../../../hooks/usePagination";
import Pagination from "../../common/Pagination";
import { getInventoryMenuCategoryNavigation } from "../../../utils/inventoryMenuCategoryUtils";

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
  onDeleteMenuItems,
  isDeleting = false,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [activeGroupId, setActiveGroupId] = useState("all");
  const categoryOptionsId = useId();

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

  const categoryNavigation = useMemo(
    () => getInventoryMenuCategoryNavigation(mainCategories, subCategories, menuItems),
    [mainCategories, subCategories, menuItems]
  );
  const activeGroup = categoryNavigation.groups.find((group) => group.id === activeGroupId);
  const visibleCategoryCards = activeGroupId === "foods" ? categoryNavigation.foods : categoryNavigation.drinks;

  const visibleSubCategories = useMemo(() => {
    if (activeGroupId !== "foods" || activeMainCategoryId === "all") {
      return [];
    }

    return subCategories.filter(
      (subCategory) => subCategory.mainCategoryId === activeMainCategoryId
    );
  }, [subCategories, activeGroupId, activeMainCategoryId]);

  const filteredMenuItems = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    const matches = menuItems.filter((item) => {
      const matchesSearch =
        searchValue === "" || item.name.toLowerCase().includes(searchValue);

      const matchesMainCategory =
        activeMainCategoryId === "all" ||
        item.mainCategoryId === activeMainCategoryId;

      const matchesGroup = activeGroup.mainCategoryIds === null
        || activeGroup.mainCategoryIds.includes(item.mainCategoryId);

      const matchesSubCategory =
        activeSubCategoryId === "all" ||
        item.subCategoryId === activeSubCategoryId;

      return matchesSearch && matchesGroup && matchesMainCategory && matchesSubCategory;
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
  }, [menuItems, ingredients, mainCategories, subCategories, searchTerm, activeGroup, activeMainCategoryId, activeSubCategoryId, sortBy, sortDirection]);

  const pagination = usePagination(filteredMenuItems, [searchTerm, activeGroupId, activeMainCategoryId, activeSubCategoryId, sortBy, sortDirection]);
  const selection = useInventorySelection(pagination.rows);

  async function handleDeleteSelected() {
    if (isDeleting || selection.selectedRows.length === 0) return;
    const deletedIds = await onDeleteMenuItems(selection.selectedRows);
    selection.clearDeleted(deletedIds);
  }

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
    selection.clearSelection();
  }

  function handleGroupChange(groupId) {
    setActiveGroupId(groupId);
    setActiveMainCategoryId("all");
    setActiveSubCategoryId("all");
    selection.clearSelection();
  }

  return (
    <section className="inventory-table-card inventory-menu-card">
      <div className="inventory-menu-filters">
        <div className="inventory-menu-search-sort">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              selection.clearSelection();
            }}
            disabled={isDeleting}
            placeholder="Search menu item"
            aria-label="Search menu item"
            className="inventory-menu-search"
          />
        </div>

        <div className="menu-main-category-grid" role="group" aria-label="Menu groups">
          {categoryNavigation.groups.map((category) => (
            <button
              key={category.id}
              type="button"
              className={
                activeGroupId === category.id
                  ? "menu-main-category-card active"
                  : "menu-main-category-card"
              }
              onClick={() => handleGroupChange(category.id)}
              aria-pressed={activeGroupId === category.id}
              aria-expanded={category.id === "all" ? undefined : activeGroupId === category.id}
              aria-controls={category.id === "all" ? undefined : categoryOptionsId}
              disabled={isDeleting}
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

        <div id={categoryOptionsId} className="menu-category-options" hidden={activeGroupId === "all"}>
          <div className="menu-main-category-grid" role="group" aria-label={activeGroupId === "foods" ? "Food categories" : "Drink categories"}>
            {visibleCategoryCards.map((category) => {
              const isActive = activeGroupId === "foods"
                ? activeMainCategoryId === category.id
                : activeSubCategoryId === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`menu-main-category-card${isActive ? " active" : ""}`}
                  aria-pressed={isActive}
                  onClick={() => {
                    if (activeGroupId === "foods") handleMainCategoryChange(category.id);
                    else {
                      setActiveMainCategoryId(category.mainCategoryId);
                      setActiveSubCategoryId(category.id);
                      selection.clearSelection();
                    }
                  }}
                  disabled={isDeleting}
                >
                  <span>{category.name.charAt(0)}</span>
                  <div>
                    <strong>{category.name}</strong>
                    <p>{category.count} items</p>
                    {category.description && <small>{category.description}</small>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {visibleSubCategories.length > 0 && <div className="menu-subcategory-pill-row">
          <button
            type="button"
            className={activeSubCategoryId === "all" ? "active" : ""}
            aria-pressed={activeSubCategoryId === "all"}
            onClick={() => {
              setActiveSubCategoryId("all");
              selection.clearSelection();
            }}
            disabled={isDeleting}
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
                aria-pressed={activeSubCategoryId === subCategory.id}
                onClick={() => {
                  setActiveSubCategoryId(subCategory.id);
                  selection.clearSelection();
                }}
                disabled={isDeleting}
              >
                {subCategory.name} {count}
              </button>
            );
          })}
        </div>}
      </div>
        <div className="inventory-table-header">
          <div>
            <h2>Menu Items</h2>
            <p>
              Availability is based on whether all required ingredients are
              currently available.
            </p>
            <p>{filteredMenuItems.length} result(s){selection.selectedRows.length > 0 ? ` · ${selection.selectedRows.length} selected` : ""}</p>
          </div>
          <button
            type="button"
            className="primary-button inventory-bulk-delete-button"
            disabled={selection.selectedRows.length === 0 || isDeleting}
            onClick={handleDeleteSelected}
          >
            {isDeleting ? "Archiving..." : "Archive"}
          </button>
        </div>

        {filteredMenuItems.length > 0 ? (
          <div className="inventory-table-scroll" role="region" aria-label="Menu items table" tabIndex={0}>
            <table className="inventory-table menu-inventory-table" aria-label="Menu Items">
              <thead>
                <tr>
                  <th scope="col" className="inventory-checkbox-cell">
                    <input
                      type="checkbox"
                      aria-label="Select all visible menu items"
                      checked={selection.allSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = selection.selectedRows.length > 0 && !selection.allSelected;
                      }}
                      disabled={isDeleting}
                      onChange={selection.toggleAll}
                    />
                  </th>
                  <SortableHeader label="Menu Item" column="name" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                  <SortableHeader label="Type" column="type" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                  <SortableHeader label="Main Category" column="mainCategory" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                  <SortableHeader label="Subcategory" column="subCategory" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                  <th>Required Ingredients</th>
                  <SortableHeader label="Price" column="price" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                  <SortableHeader label="Availability" column="availability" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                </tr>
              </thead>

              <tbody>
                {pagination.rows.map((item) => {
                  const availability = getMenuItemAvailability(item, ingredients);

                  return (
                    <tr
                      key={item.id}
                      className={selection.selectedRows.some((row) => row.id === item.id) ? "inventory-data-row selected" : "inventory-data-row"}
                      tabIndex={isDeleting ? -1 : 0}
                      aria-label={`Edit menu item ${item.name}`}
                      onClick={() => { if (!isDeleting) onEditMenuItem(item); }}
                      onKeyDown={(event) => {
                        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          if (!isDeleting) onEditMenuItem(item);
                        }
                      }}
                    >
                      <td className="inventory-checkbox-cell" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select menu item ${item.name}`}
                          checked={selection.selectedRows.some((row) => row.id === item.id)}
                          disabled={isDeleting}
                          onChange={() => selection.toggleSelection(item.id)}
                        />
                      </td>
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

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <section className="admin-empty-state">
            <h2>No menu items found</h2>
            <p>Try changing the search, main category, or subcategory.</p>
          </section>
        )}
      <Pagination pagination={pagination} label="Menu Items" disabled={isDeleting} onPageChange={(page) => { selection.clearSelection(); pagination.setPage(page); }} />
    </section>
  );
}

export default MenuItemSection;
