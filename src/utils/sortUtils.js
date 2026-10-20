// Sort a copy of the visible records without changing the original data.
export function sortRecords(records, getValue, direction = "asc", type = "text") {
  const multiplier = direction === "desc" ? -1 : 1;

  return [...records].sort((a, b) => {
    const left = getValue(a);
    const right = getValue(b);
    const isMissing = (value) => value == null || value === "" ||
      (typeof value === "number" && !Number.isFinite(value));

    // Dates not supplied (e.g. items without expiration) remain at the bottom.
    if (isMissing(left) && isMissing(right)) return 0;
    if (isMissing(left)) return 1;
    if (isMissing(right)) return -1;

    let result;
    if (type === "number" || type === "date") {
      const x = type === "date" ? Date.parse(left) : Number(left);
      const y = type === "date" ? Date.parse(right) : Number(right);
      if (!Number.isFinite(x) && !Number.isFinite(y)) return 0;
      if (!Number.isFinite(x)) return 1;
      if (!Number.isFinite(y)) return -1;
      result = x - y;
    } else {
      result = String(left).localeCompare(String(right), "en", {
        sensitivity: "base", numeric: true,
      });
    }

    return result * multiplier;
  });
}

// Combines the separate date and 12-hour time used by Super Admin orders.
export function getOrderDateTime(order) {
  if (order.createdAt) return order.createdAt;
  const date = order.orderDate || "";
  const time = String(order.orderTime || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!time) return `${date}T00:00:00`;

  // Explicit 12-hour parsing avoids browser differences with Date.parse("09:15 AM").
  const twelveHour = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelveHour) {
    const hour = Number(twelveHour[1]) % 12 + (twelveHour[3].toUpperCase() === "PM" ? 12 : 0);
    const minute = Number(twelveHour[2]);
    if (minute > 59) return null;
    return `${date}T${String(hour).padStart(2, "0")}:${twelveHour[2]}:00`;
  }
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? `${date}T${time}:00` : null;
}
