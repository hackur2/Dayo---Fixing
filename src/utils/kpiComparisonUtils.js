// Compare matching periods only: (current - previous) / previous × 100.
export function getPercentageChange(currentValue, previousValue) {
  if (previousValue === null || previousValue === undefined || previousValue === "") {
    return { kind: "unavailable", percent: null };
  }

  const current = Number(currentValue);
  const previous = Number(previousValue);

  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous < 0) {
    return { kind: "unavailable", percent: null };
  }
  if (previous === 0) {
    return {
      kind: current > 0 ? "new" : "unavailable",
      percent: null,
    };
  }

  const percent = ((current - previous) / previous) * 100;
  if (Math.abs(percent) < 0.05) {
    return { kind: "flat", percent: 0 };
  }
  return { kind: percent > 0 ? "up" : "down", percent };
}

// Local calendar date, unlike toISOString() which may shift to UTC's day.
export function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPreviousEqualDateRange(startDate, endDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || "") ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate || "")) {
    return null;
  }
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;

  const DAY = 86400000;
  const length = Math.round((end - start) / DAY) + 1;
  const previousEnd = new Date(start - DAY).toISOString().slice(0, 10);
  const previousStart = new Date(start - length * DAY).toISOString().slice(0, 10);
  return { start: previousStart, end: previousEnd };
}

export function getRecentOrderTrends(orders, today = new Date()) {
  // Recent seven *calendar days* against the seven immediately before them.
  // Order Summary cards themselves still show all-time totals.
  const lastDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const currentStart = new Date(lastDay);
  currentStart.setDate(currentStart.getDate() - 6);
  const previousStart = new Date(lastDay);
  previousStart.setDate(previousStart.getDate() - 13);
  const previousEnd = new Date(lastDay);
  previousEnd.setDate(previousEnd.getDate() - 7);
  const currentStartKey = formatLocalDate(currentStart);
  const previousStartKey = formatLocalDate(previousStart);
  const previousEndKey = formatLocalDate(previousEnd);
  const endKey = formatLocalDate(lastDay);

  const result = {
    current: { count: 0, revenue: 0 },
    previous: { count: 0, revenue: 0 },
    hasPriorData: false,
  };
  for (const order of Array.isArray(orders) ? orders : []) {
    const day = String(order?.orderDate || order?.createdAt || "").slice(0, 10);
    const bucket = day >= currentStartKey && day <= endKey
      ? result.current
      : day >= previousStartKey && day <= previousEndKey
        ? result.previous : null;
    if (!bucket) continue;
    bucket.count += 1;
    // Match existing Order Summary calculation: only Completed orders count as revenue.
    if (order.status === "Completed") {
      bucket.revenue += Number(order.totalAmount) || 0;
    }
    if (bucket === result.previous) result.hasPriorData = true;
  }
  return result;
}
