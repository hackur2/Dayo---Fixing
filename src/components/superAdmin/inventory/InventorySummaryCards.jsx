import { Link } from "react-router";
import { SUPER_ADMIN_ROUTES } from "../../../constants/routes";

function InventorySummaryCards({ summary }) {
  return (
    <section className="inventory-summary-grid">
      <article className="inventory-summary-card featured">
        <span>Ingredients</span>
        <strong>{summary.ingredientCount}</strong>
      </article>

      <article className="inventory-summary-card">
        <span>Menu Items</span>
        <strong>{summary.menuItemCount}</strong>
      </article>

      <article className="inventory-summary-card">
        <span>Estimated Inventory Total Price</span>
        <strong>{summary.valuation.hasValue ? `₱${summary.valuation.totalValue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</strong>
        <p className="inventory-valuation-note">{summary.valuation.missingCostCount > 0 ? `${summary.valuation.missingCostCount} stocked ingredient${summary.valuation.missingCostCount === 1 ? " needs" : "s need"} unit cost${summary.valuation.pricedStockCount > 0 ? " · priced stock only" : ""}` : "Current stock × unit cost"}</p>
      </article>

      <Link to={SUPER_ADMIN_ROUTES.LOW_STOCK} className="inventory-summary-card warning inventory-summary-card-link">
        <span>Low Stock</span>
        <strong>{summary.lowStockIngredients}</strong>
      </Link>
    </section>
  );
}

export default InventorySummaryCards;
