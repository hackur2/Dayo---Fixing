import { useId, useState } from "react";
import { Link } from "react-router";

import { STORAGE_KEYS } from "../../../constants/storageKeys";
import { SUPER_ADMIN_ROUTES } from "../../../constants/routes";
import { getDailyIncomeProgress } from "../../../utils/dashboardUtils";
import { getOrderSourceLabel, MANUAL_ORDER_SOURCE } from "../../../utils/orderUtils";

const DEFAULT_DAILY_INCOME_TARGET = 2000;
const SOURCE_COLORS = { "QR Order": "#a52a2a", [MANUAL_ORDER_SOURCE]: "#d2a542", "Sumo AI": "#8f9779" };
const PIPELINE_COLORS = { Pending: "#d2a542", Preparing: "#a52a2a", Ready: "#8f9779" };

function formatPeso(amount) {
  return `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

function readDailyTarget() {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEYS.DAILY_INCOME_TARGET));
    return Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_DAILY_INCOME_TARGET;
  } catch {
    return DEFAULT_DAILY_INCOME_TARGET;
  }
}

function DashboardRing({ segments, value, caption, label, rounded = false }) {
  return (
    <div className="dashboard-insight-ring" role="img" aria-label={label}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="dashboard-ring-track" cx="60" cy="60" r="48" fill="none" strokeWidth="12" />
        {segments.filter((segment) => segment.percent > 0).map((segment, index, visibleSegments) => (
          <circle
            key={segment.name}
            cx="60" cy="60" r="48" fill="none" strokeWidth="12" pathLength="100"
            stroke={segment.color}
            strokeLinecap={rounded ? "round" : "butt"}
            strokeDasharray={`${Math.min(segment.percent, 100)} 100`}
            strokeDashoffset={-visibleSegments.slice(0, index).reduce((total, item) => total + item.percent, 0)}
            transform="rotate(-90 60 60)"
          />
        ))}
      </svg>
      <div className="dashboard-ring-center" aria-hidden="true">
        <strong>{value}</strong>
        {caption && <span>{caption}</span>}
      </div>
    </div>
  );
}

export function OrderSourcesCard({ sources, isUnavailable }) {
  const totalOrders = sources.reduce((total, item) => total + item.count, 0);
  const segments = sources.map((item) => ({
    name: item.source,
    percent: totalOrders > 0 ? item.count / totalOrders * 100 : 0,
    color: SOURCE_COLORS[item.source] ?? "#6f6258",
  }));

  return (
    <article className="dashboard-panel dashboard-insight-card dashboard-order-sources-panel">
      <div className="dashboard-insight-header">
        <h2><Link to={SUPER_ADMIN_ROUTES.ORDERS}>Order Sources</Link></h2>
      </div>
      <div className="dashboard-insight-body dashboard-distribution-body">
        <ul className="dashboard-order-sources-legend" aria-label="Orders by source">
          {sources.map((item) => (
            <li key={item.source}>
              <span className="dashboard-source-label">
                <i style={{ backgroundColor: SOURCE_COLORS[item.source] ?? "#6f6258" }} aria-hidden="true" />
                {getOrderSourceLabel(item.source)}
              </span>
              <strong>{isUnavailable ? "—" : item.count.toLocaleString("en-PH")}</strong>
            </li>
          ))}
        </ul>
        <DashboardRing
          segments={isUnavailable ? [] : segments}
          value={isUnavailable ? "—" : totalOrders.toLocaleString("en-PH")}
          caption="orders"
          label={isUnavailable ? "Order sources unavailable" : `${totalOrders} orders by source`}
        />
      </div>
    </article>
  );
}

export function OrderPipelineCard({ pipeline, isUnavailable }) {
  const active = pipeline.filter((item) => ["Pending", "Preparing", "Ready"].includes(item.status));
  const total = active.reduce((sum, item) => sum + item.count, 0);
  const segments = active.map((item) => ({ name: item.status, percent: total > 0 ? item.count / total * 100 : 0, color: PIPELINE_COLORS[item.status] }));

  return (
    <article className="dashboard-panel dashboard-insight-card dashboard-pipeline-card">
      <div className="dashboard-insight-header"><h2><Link to={SUPER_ADMIN_ROUTES.KDS}>Order Pipeline</Link></h2></div>
      <div className="dashboard-insight-body dashboard-distribution-body">
        <ul className="dashboard-order-sources-legend dashboard-pipeline-statuses" aria-label="Active orders by status">
          {active.map((item) => <li key={item.status}>
            <Link to={SUPER_ADMIN_ROUTES.KDS}>
              <span className="dashboard-source-label"><i style={{ background: PIPELINE_COLORS[item.status] }} aria-hidden="true" />{item.status}</span>
              <strong>{isUnavailable ? "—" : item.count.toLocaleString("en-PH")}</strong>
            </Link>
          </li>)}
        </ul>
        <Link to={SUPER_ADMIN_ROUTES.KDS} className="dashboard-card-link dashboard-pipeline-chart" aria-label={isUnavailable ? "View Kitchen Display" : `View ${total} active orders in Kitchen Display`}>
          <DashboardRing segments={isUnavailable ? [] : segments} value={isUnavailable ? "—" : total.toLocaleString("en-PH")} caption="active" label={isUnavailable ? "Order pipeline unavailable" : `${total} active orders by status`} />
        </Link>
      </div>
    </article>
  );
}

export function DailyIncomeTargetCard({ income, isUnavailable }) {
  const inputId = useId();
  const [target, setTarget] = useState(readDailyTarget);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTarget, setDraftTarget] = useState("");
  const [targetError, setTargetError] = useState("");
  const progress = getDailyIncomeProgress(income, target);
  const percentage = Math.round(progress);

  function editTarget() {
    setDraftTarget(String(target));
    setTargetError("");
    setIsEditing(true);
  }

  function saveTarget(event) {
    event.preventDefault();
    const nextTarget = Number(draftTarget);
    if (!Number.isFinite(nextTarget) || nextTarget <= 0) {
      setTargetError("Enter a target greater than ₱0.");
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEYS.DAILY_INCOME_TARGET, String(nextTarget));
      setTarget(nextTarget);
      setIsEditing(false);
    } catch {
      setTargetError("Unable to save the target in this browser.");
    }
  }

  return (
    <article className="dashboard-panel dashboard-insight-card dashboard-daily-target-panel">
      <div className="dashboard-insight-header">
        <h2>Daily Target Income Monitoring</h2>
        <button type="button" className="dashboard-target-edit" onClick={editTarget} aria-label="Edit daily income target" title="Edit daily target">⋮</button>
      </div>
      {isEditing ? (
        <form className="dashboard-target-form" onSubmit={saveTarget}>
          <label htmlFor={inputId}>Daily target (₱)</label>
          <input id={inputId} type="number" inputMode="decimal" min="0.01" step="0.01" required value={draftTarget} onChange={(event) => setDraftTarget(event.target.value)} aria-describedby={`${inputId}-hint`} />
          <p id={`${inputId}-hint`}>Saved in this browser.</p>
          {targetError && <p className="dashboard-target-error" role="alert">{targetError}</p>}
          <div className="dashboard-target-actions">
            <button type="button" onClick={() => setIsEditing(false)}>Cancel</button>
            <button type="submit">Save</button>
          </div>
        </form>
      ) : (
        <div className="dashboard-insight-body dashboard-target-body">
          <DashboardRing
            segments={isUnavailable ? [] : [{ name: "income", percent: Math.min(progress, 100), color: "#b01886" }]}
            value={isUnavailable ? "—" : `${percentage}%`}
            label={isUnavailable ? "Today's income unavailable" : `${percentage}% of the daily income target reached`}
            rounded
          />
          <div className="dashboard-target-income">
            <strong>{isUnavailable ? "—" : formatPeso(income)}</strong>
            <p>of {formatPeso(target)}</p>
          </div>
         
        </div>
      )}
    </article>
  );
}
