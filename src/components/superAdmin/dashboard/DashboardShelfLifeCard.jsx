import { Link } from "react-router";

import { SUPER_ADMIN_ROUTES } from "../../../constants/routes";
import { formatExpirationDate } from "../../../utils/inventoryUtils";

const STATUSES = [
  { key: "freshCount", label: "Fresh", type: "fresh" },
  { key: "expiringSoonCount", label: "Expiring Soon", type: "soon" },
  { key: "expiredCount", label: "Expired", type: "expired" },
];

function ShelfStatusIcon({ type }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    {type === "fresh" ? <path d="m8 12 2.5 2.5L16 9" />
      : type === "soon" ? <path d="M12 7v5l3 2" />
        : <path d="M12 7v6m0 4h.01" />}
  </svg>;
}

export default function DashboardShelfLifeCard({ shelfLife, isUnavailable, isLoading }) {
  return (
    <Link to={SUPER_ADMIN_ROUTES.SHELF_LIFE} className="dashboard-panel dashboard-shelf-panel dashboard-card-link" aria-labelledby="dashboard-shelf-title">
      <div className="dashboard-shelf-header">
        <h2 id="dashboard-shelf-title">Shelf Life Monitoring</h2>
        
      </div>
      <ul className="dashboard-shelf-totals" aria-label="Ingredient shelf life totals">
        {STATUSES.map((status) => <li key={status.key} className={`dashboard-shelf-status ${status.type}`}>
          <ShelfStatusIcon type={status.type} />
          <strong>{isUnavailable ? "—" : shelfLife[status.key].toLocaleString("en-PH")}</strong>
          <span>{status.label}</span>
        </li>)}
      </ul>
      <div className="dashboard-shelf-near-expiry">
        <h3>Near Expiry Ingredients</h3>
        {isUnavailable ? <p className="dashboard-shelf-message">{isLoading ? "Loading expiry data..." : "Expiry data is unavailable."}</p>
          : shelfLife.nearExpiry.length > 0 ? <ol className="dashboard-shelf-list">
            {shelfLife.nearExpiry.map((ingredient) => <li key={ingredient.id}>
              <div><strong>{ingredient.name}</strong><span>{formatExpirationDate(ingredient.expiresOn)}</span></div>
              <span className={`dashboard-shelf-days${ingredient.daysUntilExpiry === 0 ? " today" : ""}`}>
                {ingredient.daysUntilExpiry === 0 ? "Today" : `${ingredient.daysUntilExpiry} ${ingredient.daysUntilExpiry === 1 ? "day" : "days"}`}
              </span>
            </li>)}
          </ol> : <p className="dashboard-shelf-message">No ingredients expiring in the next 14 days.</p>}
        {!isUnavailable && shelfLife.undatedCount > 0 && <p className="dashboard-shelf-undated">{shelfLife.undatedCount.toLocaleString("en-PH")} in-stock {shelfLife.undatedCount === 1 ? "ingredient has" : "ingredients have"} no valid expiry date.</p>}
      </div>
    </Link>
  );
}
