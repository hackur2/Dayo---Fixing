import { useEffect, useState } from "react";
import { Link } from "react-router";

import { SUPER_ADMIN_ROUTES } from "../../constants/routes";
import { inventoryService } from "../../services/inventoryService";

const RESTOCK_CHECK_INTERVAL_MS = 10_000;
const RESTOCK_REMINDER_DURATION_MS = 5_000;

function RestockNotifications() {
  const [lowStockItems, setLowStockItems] = useState([]);
  const [isReminderVisible, setIsReminderVisible] = useState(false);

  useEffect(() => {
    let active = true;
    let reminderTimeout;

    async function refreshLowStock() {
      try {
        const ingredients = await inventoryService.getIngredients();
        if (!active) return;

        const lowStock = ingredients
          .filter((ingredient) => Number(ingredient.current_stock) <= Number(ingredient.reorder_level))
          .map((ingredient) => ({
            id: ingredient.id,
            name: ingredient.name || "Inventory item",
            currentStock: Number(ingredient.current_stock),
            reorderLevel: Number(ingredient.reorder_level),
            unit: ingredient.unit || "",
          }));

        setLowStockItems(lowStock);
        setIsReminderVisible(lowStock.length > 0);
        window.clearTimeout(reminderTimeout);
        if (lowStock.length > 0) {
          reminderTimeout = window.setTimeout(
            () => active && setIsReminderVisible(false),
            RESTOCK_REMINDER_DURATION_MS
          );
        }
      } catch (error) {
        console.error("Unable to check low stock ingredients:", error.message);
      }
    }

    refreshLowStock();
    const interval = window.setInterval(refreshLowStock, RESTOCK_CHECK_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.clearTimeout(reminderTimeout);
    };
  }, []);

  if (!isReminderVisible || lowStockItems.length === 0) return null;

  return (
    <aside className="restock-alert-stack" aria-live="assertive" aria-label="Restock notifications">
      {lowStockItems.map((item) => (
        <section className="restock-alert" key={item.id} role="alert">
          <div>
            <strong>Restock needed: {item.name}</strong>
            <p>Low stock: {item.currentStock} {item.unit} remaining (reorder level {item.reorderLevel} {item.unit}).</p>
            <Link to={SUPER_ADMIN_ROUTES.INVENTORY}>Open inventory</Link>
          </div>
          <button
            type="button"
            onClick={() => setIsReminderVisible(false)}
            aria-label={`Dismiss restock reminder for ${item.name}`}
          >
            ×
          </button>
        </section>
      ))}
    </aside>
  );
}

export default RestockNotifications;
