import { useState } from "react";
import { Link } from "react-router";

import AdminPageActions from "../../components/layout/AdminPageActions";
import Pagination from "../../components/common/Pagination";
import ChangeSupplierModal from "../../components/superAdmin/suppliers/ChangeSupplierModal";
import { SUPER_ADMIN_ROUTES } from "../../constants/routes";
import { useLowStockData } from "../../hooks/useLowStockData";
import { usePagination } from "../../hooks/usePagination";
import { formatExpirationDate } from "../../utils/inventoryUtils";

import "../../styles/superAdminInventory.css";
import "../../styles/superAdminSupplier.css";
import "../../styles/superAdminLowStock.css";

function SuperAdminLowStockPage() {
  const { lowStockItems, isLoading, loadError, reload, saveSupplier } = useLowStockData();
  const pagination = usePagination(lowStockItems);
  const [supplierIngredient, setSupplierIngredient] = useState(null);
  const [notice, setNotice] = useState("");

  function changeSupplier(ingredient) {
    setNotice("");
    setSupplierIngredient(ingredient);
  }

  async function saveSupplierDetails(supplierId, details) {
    await saveSupplier(supplierIngredient, supplierId, details);
    setSupplierIngredient(null);
    setNotice(`Supplier details for ${supplierIngredient.name} saved.`);
  }

  return (
    <section className="admin-page low-stock-page" aria-busy={isLoading}>
      <div className="admin-page-heading">
        <div>
          <h1>Low Stock</h1>
        </div>
        <AdminPageActions className="low-stock-page-actions">
          <Link className="secondary-button" to={SUPER_ADMIN_ROUTES.INVENTORY}>Back to Inventory</Link>
        </AdminPageActions>
      </div>

      {notice && <p className="low-stock-notice" role="status">{notice}</p>}
      {loadError && (
        <div className="inventory-message danger low-stock-error" role="alert">
          <p>Unable to load the low-stock list: {loadError}</p>
          <button type="button" className="secondary-button" onClick={reload}>Retry</button>
        </div>
      )}

      <section className="inventory-table-card" aria-labelledby="low-stock-list-heading">
        <div className="inventory-table-header low-stock-table-header">
          <div>
            <h2 id="low-stock-list-heading">Low-Stock Ingredients</h2>
            <p>{isLoading ? "Loading ingredients..." : loadError ? "Ingredient records are unavailable." : `${lowStockItems.length} ingredient(s)`}</p>
          </div>
          <button type="button" className="secondary-button" onClick={reload} disabled={isLoading}>Refresh</button>
        </div>
        <div className="inventory-table-scroll" role="region" aria-labelledby="low-stock-list-heading" tabIndex={0}>
          <table className="inventory-table low-stock-table" aria-label="Low-stock ingredients">
            <thead>
              <tr>
                <th scope="col">Ingredient</th>
                <th scope="col">Reorder Point</th>
                <th scope="col">Expires On</th>
                <th scope="col">Supplier Number</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && !loadError && pagination.rows.map((ingredient) => (
                <tr
                  key={ingredient.id}
                  className="inventory-data-row"
                  tabIndex={0}
                  aria-label={`Change supplier for ${ingredient.name}`}
                  onClick={() => changeSupplier(ingredient)}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      changeSupplier(ingredient);
                    }
                  }}
                >
                  <td>
                    <strong>{ingredient.name}</strong>
                    <small className="low-stock-current">Current stock: {ingredient.currentStock.toLocaleString("en-PH")} {ingredient.unit}</small>
                  </td>
                  <td>{ingredient.reorderLevel.toLocaleString("en-PH")} {ingredient.unit}</td>
                  <td>{formatExpirationDate(ingredient.expiresOn)}</td>
                  <td>
                    {ingredient.suppliers.length === 0 ? <span className="low-stock-unassigned">Not assigned</span> : (
                      <ul className="low-stock-suppliers">
                        {ingredient.suppliers.map((supplier) => (
                          <li key={supplier.id}>
                            {supplier.mobile ? (
                              <a href={`tel:${supplier.mobile.replace(/[^\d+]/g, "")}`} onClick={(event) => event.stopPropagation()}>{supplier.mobile}</a>
                            ) : <span>Number not provided</span>}
                            <small>{supplier.displayId} · {supplier.name}</small>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="low-stock-action-cell">
                    <button
                      type="button"
                      className="secondary-button low-stock-change-supplier"
                      aria-label={`Change Supplier for ${ingredient.name}`}
                      onClick={(event) => { event.stopPropagation(); changeSupplier(ingredient); }}
                    >
                      Change Supplier
                    </button>
                  </td>
                </tr>
              ))}
              {(isLoading || loadError || lowStockItems.length === 0) && (
                <tr>
                  <td colSpan={5} className="low-stock-empty" role="status">
                    {isLoading ? "Loading low-stock ingredients..." : loadError ? "Use Retry to load the list." : "No low-stock ingredients."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!loadError && <Pagination pagination={pagination} label="Low Stock" disabled={isLoading} onPageChange={pagination.setPage} />}
      </section>

      {supplierIngredient && (
        <ChangeSupplierModal ingredient={supplierIngredient} onSave={saveSupplierDetails} onClose={() => setSupplierIngredient(null)} />
      )}
    </section>
  );
}

export default SuperAdminLowStockPage;
