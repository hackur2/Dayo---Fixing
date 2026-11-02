import { useMemo, useState } from "react";

import { INVENTORY_STATUS_OPTIONS } from "../../../constants/inventory";
import SortableHeader from "../../common/SortableHeader";
import { sortRecords } from "../../../utils/sortUtils";
import { useInventorySelection } from "../../../hooks/useInventorySelection";
import { usePagination } from "../../../hooks/usePagination";
import Pagination from "../../common/Pagination";
import {
  formatExpirationDate,
  formatInventoryDate,
  getStatusClassName,
  getStockStatus,
} from "../../../utils/inventoryUtils";

function IngredientSection({ ingredients, onEditIngredient, onDeleteIngredients, isDeleting = false, initialStatusFilter = "All" }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
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

  const pagination = usePagination(filteredIngredients, [searchTerm, statusFilter, sortBy, sortDirection]);
  const selection = useInventorySelection(pagination.rows);

  async function handleDeleteSelected() {
    if (isDeleting || selection.selectedRows.length === 0) return;
    const deletedIds = await onDeleteIngredients(selection.selectedRows);
    selection.clearDeleted(deletedIds);
  }

  return (
    <>
      <section className="inventory-toolbar">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            selection.clearSelection();
          }}
          disabled={isDeleting}
          placeholder="Search ingredient"
          aria-label="Search ingredient"
        />

        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            selection.clearSelection();
          }}
          disabled={isDeleting}
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
            <p>{filteredIngredients.length} result(s){selection.selectedRows.length > 0 ? ` · ${selection.selectedRows.length} selected` : ""}</p>
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

        {filteredIngredients.length > 0 ? (
          <div className="inventory-table-scroll" role="region" aria-label="Ingredients table" tabIndex={0}>
            <table className="inventory-table" aria-label="Ingredients">
              <thead>
                <tr>
                  <th scope="col" className="inventory-checkbox-cell">
                    <input
                      type="checkbox"
                      aria-label="Select all visible ingredients"
                      checked={selection.allSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = selection.selectedRows.length > 0 && !selection.allSelected;
                      }}
                      disabled={isDeleting}
                      onChange={selection.toggleAll}
                    />
                  </th>
                  <SortableHeader label="Ingredient" column="name" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                  <SortableHeader label="Category" column="category" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                  <SortableHeader label="Current Stock" column="stock" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                  <th>Reorder Point</th>
                  <SortableHeader label="Status" column="status" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                  <SortableHeader label="Expires On" column="expires" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                  <th>Last Updated</th>
                </tr>
              </thead>

              <tbody>
                {pagination.rows.map((item) => {
                  const stockStatus = getStockStatus(item);

                  return (
                    <tr
                      key={item.id}
                      className={selection.selectedRows.some((row) => row.id === item.id) ? "inventory-data-row selected" : "inventory-data-row"}
                      tabIndex={isDeleting ? -1 : 0}
                      aria-label={`Edit ingredient ${item.name}`}
                      onClick={() => { if (!isDeleting) onEditIngredient(item); }}
                      onKeyDown={(event) => {
                        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          if (!isDeleting) onEditIngredient(item);
                        }
                      }}
                    >
                      <td className="inventory-checkbox-cell" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ingredient ${item.name}`}
                          checked={selection.selectedRows.some((row) => row.id === item.id)}
                          disabled={isDeleting}
                          onChange={() => selection.toggleSelection(item.id)}
                        />
                      </td>
                      <td>
                        <strong>{item.name}</strong>
                      </td>

                      <td>{item.category}</td>

                      <td>
                        {item.currentStock} {item.unit}
                      </td>

                      <td>
                        <span title={`ADS: ${item.averageDailySales?.toLocaleString("en-PH", { maximumFractionDigits: 6 }) ?? "—"} ${item.unit}/day · Safety stock: ${item.safetyStock?.toLocaleString("en-PH", { maximumFractionDigits: 6 }) ?? "—"} ${item.unit} · Lead time: 1 day`}>
                          {item.reorderLevel.toLocaleString("en-PH", { maximumFractionDigits: 3 })} {item.unit}
                        </span>
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

                      <td>{formatInventoryDate(item.lastUpdated)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <section className="admin-empty-state">
            <h2>No ingredients found</h2>
            <p>Try changing your search or status filter.</p>
          </section>
        )}
        <Pagination pagination={pagination} label="Ingredients" disabled={isDeleting} onPageChange={(page) => { selection.clearSelection(); pagination.setPage(page); }} />
      </section>
    </>
  );
}

export default IngredientSection;
