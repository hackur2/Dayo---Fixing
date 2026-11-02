import { getShelfLifeRows } from "./shelfLifeUtils.js";

const dashboardDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getDashboardDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dashboardDateFormatter.format(date);
}

export function getDailyIncomeProgress(income, target) {
  if (!Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, (Number(income) || 0) / target * 100);
}

const DAY_MS = 86400000;
const dateStamp = (date) => date.toISOString().slice(0, 10);
const parseDay = (value) => new Date(`${value}T00:00:00Z`);

export function buildShelfLifeSummary(ingredients, asOfDate) {
  const rows = getShelfLifeRows(ingredients, asOfDate);
  const summary = { freshCount: 0, expiringSoonCount: 0, expiredCount: 0, undatedCount: 0, nearExpiry: [] };
  for (const ingredient of rows) {
    if (ingredient.status === "Not Set") summary.undatedCount += 1;
    else if (ingredient.status === "Expired") summary.expiredCount += 1;
    else if (ingredient.status === "Expiring Soon") {
      summary.expiringSoonCount += 1;
      if (summary.nearExpiry.length < 3) summary.nearExpiry.push({ id: ingredient.id, name: ingredient.name, expiresOn: ingredient.expiresOn, daysUntilExpiry: ingredient.daysUntilExpiry });
    } else summary.freshCount += 1;
  }
  return summary;
}

export function getRevenueDateRange(revenueTrend, asOfDate, preset = "last30") {
  const end = parseDay(asOfDate);
  if (Number.isNaN(end.getTime())) return { startDate: "", endDate: "" };
  let startDate;
  if (preset === "all") {
    startDate = revenueTrend.reduce((earliest, row) => row.date && row.date < earliest ? row.date : earliest, asOfDate);
  } else if (preset === "month") startDate = `${asOfDate.slice(0, 7)}-01`;
  else if (preset === "year") startDate = `${asOfDate.slice(0, 4)}-01-01`;
  else startDate = dateStamp(new Date(end.getTime() - (preset === "last7" ? 6 : 29) * DAY_MS));
  return { startDate, endDate: asOfDate };
}

export function buildRevenueTimeline(revenueTrend, startDate, endDate) {
  const start = parseDay(startDate);
  const end = parseDay(endDate);
  const dayCount = Math.round((end - start) / DAY_MS) + 1;
  if (!Number.isFinite(dayCount) || dayCount <= 0) {
    return { data: [], totalSales: 0, totalOrders: 0, previousSales: 0, granularity: "daily", previousStartDate: "", previousEndDate: "" };
  }
  const granularity = dayCount <= 31 ? "daily" : dayCount <= 180 ? "weekly" : "monthly";
  const previousStart = new Date(start.getTime() - dayCount * DAY_MS);
  const previousEndDate = dateStamp(new Date(start.getTime() - DAY_MS));
  const previousStartDate = dateStamp(previousStart);
  const data = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const next = new Date(cursor);
    if (granularity === "monthly") next.setUTCMonth(next.getUTCMonth() + 1, 1);
    else next.setUTCDate(next.getUTCDate() + (granularity === "weekly" ? 7 : 1));
    const bucketEnd = new Date(Math.min(end.getTime(), next.getTime() - DAY_MS));
    data.push({
      startDate: dateStamp(cursor), endDate: dateStamp(bucketEnd),
      previousStartDate: dateStamp(new Date(previousStart.getTime() + cursor.getTime() - start.getTime())),
      previousEndDate: dateStamp(new Date(previousStart.getTime() + bucketEnd.getTime() - start.getTime())),
      label: cursor.toLocaleDateString("en-PH", { timeZone: "UTC", month: "short", ...(granularity === "monthly" ? { year: "numeric" } : { day: "numeric", ...(start.getUTCFullYear() !== end.getUTCFullYear() ? { year: "2-digit" } : {}) }) }),
      totalSales: 0, previousSales: 0, totalOrders: 0,
    });
    cursor = next;
  }
  for (const row of revenueTrend) {
    const isCurrent = row.date >= startDate && row.date <= endDate;
    const isPrevious = row.date >= previousStartDate && row.date <= previousEndDate;
    if (!isCurrent && !isPrevious) continue;
    const alignedDay = new Date(parseDay(row.date).getTime() + (isPrevious ? dayCount * DAY_MS : 0));
    const index = granularity === "monthly"
      ? (alignedDay.getUTCFullYear() - start.getUTCFullYear()) * 12 + alignedDay.getUTCMonth() - start.getUTCMonth()
      : Math.floor((alignedDay - start) / DAY_MS / (granularity === "weekly" ? 7 : 1));
    const bucket = data[index];
    if (!bucket) continue;
    if (isCurrent) {
      bucket.totalSales += Number(row.totalSales) || 0;
      bucket.totalOrders += Number(row.totalOrders) || 0;
    } else bucket.previousSales += Number(row.totalSales) || 0;
  }
  return {
    data, granularity, previousStartDate, previousEndDate,
    totalSales: data.reduce((sum, row) => sum + row.totalSales, 0),
    totalOrders: data.reduce((sum, row) => sum + row.totalOrders, 0),
    previousSales: data.reduce((sum, row) => sum + row.previousSales, 0),
  };
}

export function buildCustomerActivity(activity, period, asOfDate) {
  const end = new Date(`${asOfDate}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return [];
  const days = period === "monthly" ? end.getUTCDate() : 7;
  const counts = new Map(activity.map((item) => [item.date, item.count]));
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(end);
    day.setUTCDate(day.getUTCDate() - days + index + 1);
    const date = day.toISOString().slice(0, 10);
    return {
      date,
      label: period === "monthly" ? String(day.getUTCDate()) : day.toLocaleDateString("en-PH", { weekday: "short", timeZone: "UTC" }),
      count: counts.get(date) ?? 0,
    };
  });
}
