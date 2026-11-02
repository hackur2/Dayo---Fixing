import "../../styles/metricPercentage.css";

export default function MetricPercentage({ value, label, unavailable = false }) {
  return <div className="metric-percentage"><b>{unavailable || value === null || !Number.isFinite(value) ? "—" : `${value.toLocaleString("en-PH", { maximumFractionDigits: 1 })}%`}</b><small>{label}</small></div>;
}
