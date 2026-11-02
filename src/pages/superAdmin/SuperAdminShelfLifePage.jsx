import { Link } from "react-router";

import AdminPageActions from "../../components/layout/AdminPageActions";
import { SUPER_ADMIN_ROUTES } from "../../constants/routes";
import { useShelfLifeData } from "../../hooks/useShelfLifeData";
import { usePagination } from "../../hooks/usePagination";
import Pagination from "../../components/common/Pagination";
import { formatExpirationDate, getStatusClassName } from "../../utils/inventoryUtils";

import "../../styles/superAdminInventory.css";
import "../../styles/superAdminShelfLife.css";

function formatDaysRemaining(days) {
  if (days === null) return "—";
  if (days === 0) return "Expires today";
  const count = Math.abs(days).toLocaleString("en-PH");
  return `${count} ${Math.abs(days) === 1 ? "day" : "days"}${days < 0 ? " overdue" : ""}`;
}

export default function SuperAdminShelfLifePage() {
  const { shelfLifeItems, isLoading, loadError, reload } = useShelfLifeData();
  const pagination = usePagination(shelfLifeItems);

  return (
    <section className="admin-page shelf-life-page" aria-busy={isLoading}>
      <div className="admin-page-heading">
        <div><h1>Shelf Life Monitoring</h1></div>
        <AdminPageActions className="shelf-life-page-actions">
          <Link className="secondary-button" to={SUPER_ADMIN_ROUTES.INVENTORY}>Back to Inventory</Link>
        </AdminPageActions>
      </div>

      {loadError && <div className="shelf-life-error" role="alert">
        <p>Unable to load shelf life records: {loadError}</p>
        <button type="button" className="secondary-button" onClick={reload}>Retry</button>
      </div>}

      <section className="inventory-table-card" aria-labelledby="shelf-life-list-heading">
        <div className="inventory-table-header shelf-life-table-header">
          <div>
            <h2 id="shelf-life-list-heading">Ingredient Expiry List</h2>
            
            
          </div>
          <button type="button" className="secondary-button" onClick={reload} disabled={isLoading}>Refresh</button>
        </div>
        <div className="inventory-table-scroll" role="region" aria-labelledby="shelf-life-list-heading" tabIndex={0}>
          <table className="inventory-table shelf-life-table" aria-label="Ingredients sorted by shelf life status and expiry date">
            <thead><tr>
              <th scope="col">Ingredient</th>
              <th scope="col">Current Stock</th>
              <th scope="col">Expires On</th>
              <th scope="col">Time to Expiry</th>
              <th scope="col" aria-sort="other">Status</th>
            </tr></thead>
            <tbody>
              {!isLoading && !loadError && pagination.rows.map((ingredient) => <tr key={ingredient.id} className={`shelf-life-row ${ingredient.status === "Expired" ? "expired" : "active"}`}>
                <td><strong>{ingredient.name}</strong></td>
                <td>{ingredient.currentStock.toLocaleString("en-PH")} {ingredient.unit}</td>
                <td>{formatExpirationDate(ingredient.expiresOn)}</td>
                <td>{formatDaysRemaining(ingredient.daysUntilExpiry)}</td>
                <td><span className={`shelf-life-status ${getStatusClassName(ingredient.status)}`}>{ingredient.status === "Not Set" ? "Expiry not set" : ingredient.status}</span></td>
              </tr>)}
              {(isLoading || loadError || shelfLifeItems.length === 0) && <tr>
                <td colSpan={5} className="shelf-life-empty" role="status">{isLoading ? "Loading shelf life records..." : loadError ? "Use Retry to load the list." : "No in-stock ingredients to monitor."}</td>
              </tr>}
            </tbody>
          </table>
        </div>
        {!loadError && <Pagination pagination={pagination} label="Shelf Life" disabled={isLoading} onPageChange={pagination.setPage} />}
      </section>
    </section>
  );
}
