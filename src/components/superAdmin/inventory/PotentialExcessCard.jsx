import { useId } from "react";
import { Link } from "react-router";
import { SUPER_ADMIN_ROUTES } from "../../../constants/routes";
import "../../../styles/potentialExcess.css";

const formatUnits = (value, unit) => value === null ? "—" : `${Number(value).toLocaleString("en-PH", { maximumFractionDigits: 3 })} ${unit}`;

export default function PotentialExcessCard({ estimate, isUnavailable, isLoading, className = "" }) {
  const titleId = useId();
  return (
    <Link to={SUPER_ADMIN_ROUTES.POTENTIAL_EXCESS} className={`potential-excess-card ${className}`} aria-labelledby={titleId} aria-busy={isLoading}>
      <div className="potential-excess-header"><h2 id={titleId}>Potential Excess</h2><span>Before expiry</span></div>
      {isUnavailable ? <p className="potential-excess-message" role="status">{isLoading ? "Loading excess estimates..." : "Excess estimates are unavailable."}</p>
        : estimate.items.length > 0 ? <ul className="potential-excess-list" aria-label="Potential excess by ingredient">
          {estimate.items.slice(0, 3).map((item) => <li key={item.id}>
            <div><strong>{item.name}</strong><span>{item.unavailableReason || (item.isExpired ? "Expired" : `${item.remainingShelfLife} ${item.remainingShelfLife === 1 ? "day" : "days"} remaining`)}</span></div>
            <b>{formatUnits(item.potentialExcess, item.unit)}</b>
          </li>)}
        </ul> : <p className="potential-excess-message">Add ingredients to view potential excess.</p>}
    </Link>
  );
}
