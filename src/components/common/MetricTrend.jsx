import { getPercentageChange } from "../../utils/kpiComparisonUtils";

import "../../styles/kpiTrend.css";

function MetricTrend({ current, previous, periodLabel }) {
  const change = getPercentageChange(current, previous);
  const comparisonText = periodLabel ? ` ${periodLabel}` : "";

  let message = "— percentage data";
  if (change.kind === "up") {
    message = `▲ +${change.percent.toFixed(1)}%${comparisonText}`;
  } else if (change.kind === "down") {
    message = `▼ ${change.percent.toFixed(1)}%${comparisonText}`;
  } else if (change.kind === "flat") {
    message = `— 0.0%${comparisonText}`;
  } else if (change.kind === "new") {
    message = `▲ New activity${comparisonText}`;
  }

  return <p className={`metric-trend metric-trend--${change.kind}`}>{message}</p>;
}

export default MetricTrend;
