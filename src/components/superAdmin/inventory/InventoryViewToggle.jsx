import { INVENTORY_VIEWS } from "../../../constants/inventory";

function InventoryViewToggle({ activeView, onChange }) {
  return (
    <section className="inventory-view-toggle-card">
      <div className="inventory-view-toggle">
        <button
          type="button"
          className={
            activeView === INVENTORY_VIEWS.INGREDIENTS ? "active" : ""
          }
          onClick={() => onChange(INVENTORY_VIEWS.INGREDIENTS)}
        >
          Ingredients
        </button>

        <button
          type="button"
          className={
            activeView === INVENTORY_VIEWS.MENU_ITEMS ? "active" : ""
          }
          onClick={() => onChange(INVENTORY_VIEWS.MENU_ITEMS)}
        >
          Menu Items
        </button>
      </div>
    </section>
  );
}

export default InventoryViewToggle;
