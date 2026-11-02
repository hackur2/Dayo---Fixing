import { useId, useMemo } from "react";
import { Link } from "react-router";
import { SUPER_ADMIN_ROUTES } from "../../../constants/routes";
import { buildItemMovement } from "../../../utils/salesReportUtils";
import { useSalesGraphData } from "../../../hooks/useSalesGraphData";
import "../../../styles/superAdminSalesGraph.css";
import "../../../styles/itemMovement.css";

export default function ItemMovementCard({ loadReport, compact = false, refreshKey = 0 }) {
  const titleId = useId();
  const { salesReport, isSalesGraphLoading: isLoading, salesGraphError: error } = useSalesGraphData("", "", loadReport, refreshKey);
  const movement = useMemo(() => buildItemMovement(salesReport.movementItems ?? []), [salesReport.movementItems]);

  return (
    <Link to={SUPER_ADMIN_ROUTES.ITEM_MOVEMENT} className={`sales-graph-card item-movement-card${compact ? " inventory-movement-card" : ""}`} aria-labelledby={titleId} aria-busy={isLoading}>
      <div className="movement-summary-heading"><h2 id={titleId}>Fast Moving, Slow Moving Items</h2><span aria-hidden="true">↗</span></div>
      {isLoading ? <p className="movement-summary-message" role="status">Loading item movement...</p>
        : error ? <p className="movement-summary-message" role="alert">Item movement is unavailable. Open the page to retry.</p>
          : <div className="movement-summary-groups">
            {[["fast", "Top 3 Fast-moving"], ["slow", "Top 3 Slow-moving"]].map(([group, label]) => {
              const rows = movement.data.filter((item) => item.movement === group);
              return <section key={group} aria-label={label}>
                <h3>{label}</h3>
                {rows.length > 0 ? <ol>{rows.map((item) => <li key={item.id}><span>{item.name}</span><strong>{item.quantitySold.toLocaleString("en-PH")} <small>sold</small></strong></li>)}</ol>
                  : <p>No {group === "fast" ? "fast-moving" : "slow-moving"} items.</p>}
              </section>;
            })}
          </div>}
    </Link>
  );
}
