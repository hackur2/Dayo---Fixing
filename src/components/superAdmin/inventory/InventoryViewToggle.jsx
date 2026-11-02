import { INVENTORY_VIEWS } from "../../../constants/inventory";
import { Link } from "react-router";
import { SUPER_ADMIN_ROUTES } from "../../../constants/routes";

function InventoryViewToggle({ activeView, onChange, disabled = false }) {
  return (
    <section className="inventory-view-toggle-card">
      <div className="inventory-view-toggle">
        <button
          type="button"
          className={
            activeView === INVENTORY_VIEWS.INGREDIENTS ? "active" : ""
          }
          onClick={() => onChange(INVENTORY_VIEWS.INGREDIENTS)}
          disabled={disabled}
        >
          Ingredients
        </button>

        <button
          type="button"
          className={
            activeView === INVENTORY_VIEWS.MENU_ITEMS ? "active" : ""
          }
          onClick={() => onChange(INVENTORY_VIEWS.MENU_ITEMS)}
          disabled={disabled}
        >
          Menu Items
        </button>
      </div>
      <Link className="secondary-button inventory-archive-link" to={SUPER_ADMIN_ROUTES.INVENTORY_ARCHIVE} aria-disabled={disabled} tabIndex={disabled ? -1 : 0} onClick={(event) => { if (disabled) event.preventDefault(); }}>
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h16v12H4zM3 4h18v4H3zM9 12h6" /></svg>
        Archive
      </Link>
    </section>
  );
}

export default InventoryViewToggle;
