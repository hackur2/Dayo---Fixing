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
        <span>Available Menu</span>
        <strong>{summary.availableMenuItems}</strong>
      </article>

      <article className="inventory-summary-card warning">
        <span>Low Stock</span>
        <strong>{summary.lowStockIngredients}</strong>
      </article>
    </section>
  );
}

export default InventorySummaryCards;
