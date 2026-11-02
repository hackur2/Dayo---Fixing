export const SHELF_LIFE_SOON_DAYS = 14;
const STATUS_ORDER = { "Expiring Soon": 0, Expired: 1, Fresh: 2, "Not Set": 3 };

export function getShelfLifeRows(ingredients, asOfDate) {
  const today = new Date(`${asOfDate}T00:00:00Z`);
  if (Number.isNaN(today.getTime())) throw new Error("A valid date is required for shelf monitoring.");

  return ingredients.filter((ingredient) => ingredient.currentStock > 0).map((ingredient) => {
    const expiry = new Date(`${ingredient.expiresOn}T00:00:00Z`);
    const hasExpiry = /^\d{4}-\d{2}-\d{2}$/.test(ingredient.expiresOn)
      && !Number.isNaN(expiry.getTime()) && expiry.toISOString().slice(0, 10) === ingredient.expiresOn;
    const daysUntilExpiry = hasExpiry ? Math.round((expiry - today) / 86400000) : null;
    const status = !hasExpiry ? "Not Set" : daysUntilExpiry < 0 ? "Expired"
      : daysUntilExpiry <= SHELF_LIFE_SOON_DAYS ? "Expiring Soon" : "Fresh";
    return { ...ingredient, expiresOn: hasExpiry ? ingredient.expiresOn : "", daysUntilExpiry, status };
  }).sort((a, b) => {
    return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      || a.expiresOn.localeCompare(b.expiresOn)
      || a.name.localeCompare(b.name, "en-PH", { sensitivity: "base" })
      || String(a.id).localeCompare(String(b.id), "en-PH", { numeric: true });
  });
}
