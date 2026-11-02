import { useEffect, useState } from "react";
import { Link } from "react-router";
import { SUPER_ADMIN_ROUTES } from "../../constants/routes";
import { inventoryService } from "../../services/inventoryService";
import { ingredientExpiryService } from "../../services/ingredientExpiryService";
import { getExpiryReminders, notifyInventoryRefresh } from "../../utils/ingredientExpiryUtils";
import { formatExpirationDate } from "../../utils/inventoryUtils";
import { normalizeIngredientUnit } from "../../utils/ingredientUnitUtils";

const CHECK_INTERVAL_MS = 10_000;
const REMINDER_DURATION_MS = 5_000;

function RestockNotifications() {
  const [alerts, setAlerts] = useState([]);
  const [notice, setNotice] = useState({ message: "", dismissed: false });
  useEffect(() => {
    let active = true;
    let reminderTimeout;
    let previousSignature;
    let pending = false;
    function updateNotice(message) {
      setNotice((current) => current.message === message ? current : { message, dismissed: false });
    }
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const status = await ingredientExpiryService.synchronize();
        const ingredients = (await inventoryService.getIngredients()).map((item) => ({ ...item, unit: normalizeIngredientUnit(item.unit) }));
        if (!active) return;
        updateNotice(status.configured ? "" : "Automatic expiry stock clearing needs database setup. Run the stock-only Ingredient Expiry SQL correction.");
        const signature = JSON.stringify(ingredients.map((item) => [item.id, item.current_stock, item.reorder_level, item.unit, item.expires_on, item.archived_at]));
        if (previousSignature !== undefined && signature !== previousSignature) notifyInventoryRefresh();
        previousSignature = signature;
        const lowStock = ingredients.filter((item) => Number(item.current_stock) <= Number(item.reorder_level))
          .map((item) => ({ ...item, key: `low:${item.id}`, type: "low" }));
        const expiring = getExpiryReminders(ingredients).map((item) => ({ ...item, key: `expiry:${item.id}`, type: "expiry" }));
        setAlerts([...expiring, ...lowStock]);
        window.clearTimeout(reminderTimeout);
        reminderTimeout = window.setTimeout(() => { if (active) setAlerts([]); }, REMINDER_DURATION_MS);
      } catch (error) {
        console.error("Unable to check inventory notifications:", error.message);
        if (active) updateNotice("Unable to check ingredient expiry. Checks will retry automatically.");
      } finally { pending = false; }
    }
    refresh();
    const interval = window.setInterval(refresh, CHECK_INTERVAL_MS);
    return () => { active = false; window.clearInterval(interval); window.clearTimeout(reminderTimeout); };
  }, []);
  const visibleNotice = notice.dismissed ? "" : notice.message;
  if (!visibleNotice && alerts.length === 0) return null;
  return (
    <aside className="restock-alert-stack" aria-live="polite" aria-label="Inventory notifications">
      {visibleNotice && <section className="restock-alert inventory-expiry-notice" role="alert">
        <div><strong>Ingredient expiry</strong><p>{visibleNotice}</p></div>
        <button
          type="button"
          className="restock-alert-close"
          onClick={() => setNotice((current) => ({ ...current, dismissed: true }))}
          aria-label="Dismiss ingredient expiry notification"
          title="Close notification"
        ><span aria-hidden="true">×</span></button>
      </section>}
      {alerts.map((item) => <section className={`restock-alert${item.type === "expiry" ? " expiry-alert" : ""}`} key={item.key} role="alert">
        <div>
          <strong>{item.type === "expiry" ? "Expiring soon" : "Restock needed"}: {item.name || "Inventory item"}</strong>
          {item.type === "expiry" ? <p>Expires in {item.daysUntilExpiry} {item.daysUntilExpiry === 1 ? "day" : "days"} ({formatExpirationDate(item.expires_on)}). {Number(item.current_stock).toLocaleString("en-PH")} {item.unit} remaining.</p>
            : <p>Low stock: {item.current_stock} {item.unit} remaining (reorder level {item.reorder_level} {item.unit}).</p>}
          <Link to={item.type === "expiry" ? SUPER_ADMIN_ROUTES.SHELF_LIFE : SUPER_ADMIN_ROUTES.INVENTORY}>{item.type === "expiry" ? "Open Shelf Life" : "Open inventory"}</Link>
        </div>
        <button type="button" onClick={() => setAlerts((rows) => rows.filter((row) => row.key !== item.key))} aria-label={`Dismiss ${item.type === "expiry" ? "expiry" : "restock"} reminder for ${item.name}`}>×</button>
      </section>)}
    </aside>
  );
}
export default RestockNotifications;
