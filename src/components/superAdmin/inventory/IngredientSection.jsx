import { useEffect, useMemo, useState } from "react";

import { INVENTORY_STATUS_OPTIONS } from "../../../constants/inventory";
import SortableHeader from "../../common/SortableHeader";
import { sortRecords } from "../../../utils/sortUtils";
import {
  formatExpirationDate,
  getStatusClassName,
  getStockStatus,
} from "../../../utils/inventoryUtils";

function IngredientSection({ ingredients, onEditIngredient, onDeleteIngredient, initialStatusFilter = "All" }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);
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

  const filteredIngredients = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    const matches = ingredients.filter((item) => {
      const stockStatus = getStockStatus(item);

      const matchesSearch =
        searchValue === "" ||
        item.name.toLowerCase().includes(searchValue) ||
        item.category.toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === "All" || stockStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
    const getters = {
      name: [(item) => item.name, "text"],
      category: [(item) => item.category, "text"],
      status: [(item) => getStockStatus(item), "text"],
      stock: [(item) => item.currentStock, "number"],
      expires: [(item) => item.expiresOn, "date"],
    };
    const [getter, type] = getters[sortBy];
    return sortRecords(matches, getter, sortDirection, type);
  }, [ingredients, searchTerm, statusFilter, sortBy, sortDirection]);

  return (
    <>
      <section className="inventory-toolbar">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search ingredient"
          aria-label="Search ingredient"
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by stock status"
        >
          {INVENTORY_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </section>

      <section className="inventory-table-card">
        <div className="inventory-table-header">
          <div>
            <h2>Ingredients</h2>
            <p>{filteredIngredients.length} result(s)</p>
          </div>
        </div>

        {filteredIngredients.length > 0 ? (
          <table className="inventory-table">
            <thead>
              <tr>
                <SortableHeader label="Ingredient" column="name" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <SortableHeader label="Category" column="category" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <SortableHeader label="Current Stock" column="stock" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <th>Reorder Level</th>
                <SortableHeader label="Status" column="status" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <SortableHeader label="Expires On" column="expires" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredIngredients.map((item) => {
                const stockStatus = getStockStatus(item);

                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>

                    <td>{item.category}</td>

                    <td>
                      {item.currentStock} {item.unit}
                    </td>

                    <td>
                      {item.reorderLevel} {item.unit}
                    </td>

                    <td>
                      <span
                        className={`inventory-status-badge ${getStatusClassName(
                          stockStatus
                        )}`}
                      >
                        {stockStatus}
                      </span>
                    </td>

                    <td>{formatExpirationDate(item.expiresOn)}</td>

                    <td>{item.lastUpdated}</td>

                    <td>
                      <button
                        type="button"
                        className="secondary-button inventory-small-button"
                        onClick={() => onEditIngredient(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="secondary-button inventory-small-button inventory-delete-button"
                        onClick={() => onDeleteIngredient(item)}
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
            <h2>No ingredients found</h2>
            <p>Try changing your search or status filter.</p>
          </section>
        )}
      </section>
    </>
  );
}

export default IngredientSection;
