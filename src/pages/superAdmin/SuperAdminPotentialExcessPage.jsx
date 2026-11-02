import { useMemo, useState } from "react";
import { Link } from "react-router";
import AdminPageActions from "../../components/layout/AdminPageActions";
import SortableHeader from "../../components/common/SortableHeader";
import { SUPER_ADMIN_ROUTES } from "../../constants/routes";
import { usePotentialExcessData } from "../../hooks/usePotentialExcessData";
import { formatExpirationDate } from "../../utils/inventoryUtils";
import { sortRecords } from "../../utils/sortUtils";
import "../../styles/superAdminInventory.css";
import "../../styles/potentialExcess.css";

const formatUnits = (value, unit) => value === null ? "—" : `${Number(value).toLocaleString("en-PH", { maximumFractionDigits: 3 })} ${unit}`;

export default function SuperAdminPotentialExcessPage() {
  const { estimate, isLoading, error, reload } = usePotentialExcessData();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("potentialExcess");
  const [direction, setDirection] = useState("desc");
  const rows = useMemo(() => sortRecords(
    estimate.items.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase())),
    (item) => item[sortBy], direction, sortBy === "name" ? "text" : "number"
  ), [estimate.items, search, sortBy, direction]);

  function handleSort(column) {
    setDirection((current) => sortBy === column ? current === "asc" ? "desc" : "asc" : column === "name" ? "asc" : "desc");
    setSortBy(column);
  }

  return (
    <section className="admin-page potential-excess-page" aria-busy={isLoading}>
      <div className="admin-page-heading">
        <div><h1>Potential Excess</h1><p>Ingredient stock remaining before expiry{estimate.asOfDate ? ` · As of ${formatExpirationDate(estimate.asOfDate)}` : ""}</p></div>
        <AdminPageActions className="potential-excess-actions">
          <Link className="secondary-button" to={SUPER_ADMIN_ROUTES.INVENTORY}>Back to Inventory</Link>
          <button className="secondary-button" type="button" onClick={reload} disabled={isLoading}>Refresh</button>
        </AdminPageActions>
      </div>
      {error && <p className="inventory-message danger" role="alert">Unable to load potential excess: {error}</p>}
      <section className="inventory-table-card" aria-label="Potential excess estimates">
        <div className="potential-excess-toolbar">
          <input type="search" aria-label="Search potential excess ingredients" placeholder="Search ingredient" value={search} onChange={(event) => setSearch(event.target.value)} />
          <span>{isLoading ? "Loading estimates..." : `${rows.length} ingredient(s)`}</span>
        </div>
        <div className="inventory-table-scroll" role="region" aria-label="Potential excess table" tabIndex={0}>
          <table className="inventory-table potential-excess-table">
            <thead><tr>
              <SortableHeader label="Ingredient" column="name" sortBy={sortBy} direction={direction} onSort={handleSort} />
              <SortableHeader label="Weekly Consumption (units)" column="weeklyConsumption" sortBy={sortBy} direction={direction} onSort={handleSort} />
              <SortableHeader label="Current Stock (units)" column="currentStock" sortBy={sortBy} direction={direction} onSort={handleSort} />
              <SortableHeader label="Remaining Shelf Life (days)" column="remainingShelfLife" sortBy={sortBy} direction={direction} onSort={handleSort} />
              <SortableHeader label="Potential Excess (units)" column="potentialExcess" sortBy={sortBy} direction={direction} onSort={handleSort} />
            </tr></thead>
            <tbody>
              {!isLoading && !error && rows.map((item) => <tr key={item.id}>
                <td><strong>{item.name}</strong>{item.unavailableReason && <small>{item.unavailableReason}</small>}</td>
                <td>{formatUnits(item.weeklyConsumption, item.unit)}</td>
                <td>{formatUnits(item.currentStock, item.unit)}</td>
                <td>{item.remainingShelfLife === null ? "—" : `${item.remainingShelfLife} ${item.remainingShelfLife === 1 ? "day" : "days"}`}{item.expiresOn && <small>{item.isExpired ? "Expired · " : "Expires "}{formatExpirationDate(item.expiresOn)}</small>}</td>
                <td><strong>{formatUnits(item.potentialExcess, item.unit)}</strong></td>
              </tr>)}
              {(isLoading || error || rows.length === 0) && <tr><td colSpan={5} className="potential-excess-empty" role="status">{isLoading ? "Loading excess estimates..." : error ? "Use Refresh to try again." : "No matching ingredients."}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <details className="potential-excess-method"><summary>How this is estimated</summary>
        <p><strong>PE = max(0, CS − ((WC ÷ 7) × RSL))</strong></p>
        <p>WC is the ingredient consumption recorded for completed orders during the previous seven complete days{estimate.consumptionStartDate ? ` (${formatExpirationDate(estimate.consumptionStartDate)} – ${formatExpirationDate(estimate.consumptionEndDate)})` : ""}. Manual stock edits and restocks are excluded. CS is current inventory stock. RSL is the number of days until the ingredient expires, with expired ingredients set to zero remaining days.</p>
        <p>Weekly consumption, current stock, and potential excess use each ingredient’s inventory unit. Quantities display up to three decimal places. Ingredients without a valid expiry date show an unavailable estimate.</p>
      </details>
    </section>
  );
}
