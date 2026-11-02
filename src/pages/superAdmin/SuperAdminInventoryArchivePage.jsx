import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

import AdminPageActions from "../../components/layout/AdminPageActions";
import SortableHeader from "../../components/common/SortableHeader";
import { SUPER_ADMIN_ROUTES } from "../../constants/routes";
import { INVENTORY_VIEWS } from "../../constants/inventory";
import { useIngredientArchiveData } from "../../hooks/useIngredientArchiveData";
import { useMenuArchiveData } from "../../hooks/useMenuArchiveData";
import { formatExpirationDate, formatInventoryDate } from "../../utils/inventoryUtils";
import { sortRecords } from "../../utils/sortUtils";

import "../../styles/superAdminInventory.css";
import "../../styles/superAdminInventoryArchive.css";

export default function SuperAdminInventoryArchivePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMenu = searchParams.get("view") === INVENTORY_VIEWS.MENU_ITEMS;
  const ingredientArchive = useIngredientArchiveData();
  const menuArchive = useMenuArchiveData();
  const { isLoading, loadError, reload } = isMenu ? menuArchive : ingredientArchive;
  const records = isMenu ? menuArchive.menuItems : ingredientArchive.ingredients;
  const title = isMenu ? "Archived Menu Items" : "Archived Ingredients";
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("archived");
  const [direction, setDirection] = useState("desc");
  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("en-PH");
    const matches = records.filter((row) => `${row.name} ${isMenu ? row.type : row.category}`.toLocaleLowerCase("en-PH").includes(term));
    const getter = {
      archived: (row) => isMenu ? row.lastUpdated : row.archivedAt,
      name: (row) => row.name, category: (row) => row.category,
      type: (row) => row.type, price: (row) => Number(row.price),
    }[sortBy];
    return sortRecords(matches, getter, direction, sortBy === "archived" ? "date" : sortBy === "price" ? "number" : "text");
  }, [records, isMenu, search, sortBy, direction]);

  function switchView(view) {
    setSearch(""); setSortBy("archived"); setDirection("desc");
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("view", view);
      return next;
    });
  }

  function sort(column) {
    setDirection(sortBy === column ? direction === "asc" ? "desc" : "asc" : column === "archived" ? "desc" : "asc");
    setSortBy(column);
  }

  return (
    <section className="admin-page inventory-archive-page" aria-busy={isLoading}>
      <div className="admin-page-heading">
        <div><h1>Archive</h1></div>
        <AdminPageActions className="inventory-archive-actions"><Link className="secondary-button" to={`${SUPER_ADMIN_ROUTES.INVENTORY}?view=${isMenu ? INVENTORY_VIEWS.MENU_ITEMS : INVENTORY_VIEWS.INGREDIENTS}`}>Back to Inventory</Link></AdminPageActions>
      </div>
      <section className="inventory-view-toggle-card">
        <div className="inventory-view-toggle" role="group" aria-label="Archived item type">
          <button type="button" className={!isMenu ? "active" : ""} aria-pressed={!isMenu} onClick={() => switchView(INVENTORY_VIEWS.INGREDIENTS)}>Ingredients</button>
          <button type="button" className={isMenu ? "active" : ""} aria-pressed={isMenu} onClick={() => switchView(INVENTORY_VIEWS.MENU_ITEMS)}>Menu Items</button>
        </div>
      </section>
      {loadError && <div className="inventory-archive-error" role="alert"><p>{loadError}</p><button type="button" className="secondary-button" onClick={reload}>Retry</button></div>}
      <section className="inventory-archive-toolbar">
        <input type="search" aria-label={isMenu ? "Search archived menu items" : "Search archived ingredients"} placeholder={isMenu ? "Search menu item or type" : "Search ingredient or category"} value={search} onChange={(event) => setSearch(event.target.value)} />
        <button type="button" className="secondary-button" onClick={reload} disabled={isLoading}>Refresh</button>
      </section>
      <section className="inventory-table-card" aria-labelledby="inventory-archive-heading">
        <div className="inventory-table-header"><div><h2 id="inventory-archive-heading">{title}</h2><p>{!isLoading && !loadError ? `${rows.length} result(s)` : ""}</p></div></div>
        <div className="inventory-table-scroll" role="region" aria-labelledby="inventory-archive-heading" tabIndex={0}>
          <table className={`inventory-table ${isMenu ? "menu-archive-table" : "ingredient-archive-table"}`} aria-label={title}>
            <thead><tr>
              <SortableHeader label={isMenu ? "Menu Item" : "Ingredient"} column="name" sortBy={sortBy} direction={direction} onSort={sort} />
              {isMenu ? <>
                <SortableHeader label="Type" column="type" sortBy={sortBy} direction={direction} onSort={sort} />
                <SortableHeader label="Price" column="price" sortBy={sortBy} direction={direction} onSort={sort} />
              </> : <>
                <SortableHeader label="Category" column="category" sortBy={sortBy} direction={direction} onSort={sort} />
                <th scope="col">Stock at Archive</th><th scope="col">Reorder Level</th><th scope="col">Expires On</th><th scope="col">Reason</th>
              </>}
              <SortableHeader label={isMenu ? "Last Updated" : "Archived On"} column="archived" sortBy={sortBy} direction={direction} onSort={sort} />
            </tr></thead>
            <tbody>
              {!isLoading && !loadError && rows.map((row) => <tr key={row.id}>
                <td><strong>{row.name}</strong></td>
                {isMenu ? <>
                  <td>{row.type}</td><td>₱{Number(row.price).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>{formatInventoryDate(row.lastUpdated)}</td>
                </> : <>
                  <td>{row.category}</td><td>{row.currentStock.toLocaleString("en-PH")} {row.unit}</td><td>{row.reorderLevel.toLocaleString("en-PH")} {row.unit}</td><td>{formatExpirationDate(row.expiresOn)}</td><td><span className={`archive-reason ${row.archiveReason}`}>{row.archiveReason === "expired" ? "Expired · stock set to 0" : "Archived"}</span></td><td>{formatInventoryDate(row.archivedAt)}</td>
                </>}
              </tr>)}
              {(isLoading || loadError || rows.length === 0) && <tr><td colSpan={isMenu ? 4 : 7} className="inventory-archive-empty" role="status">{isLoading ? `Loading ${title.toLowerCase()}...` : loadError ? "Use Retry to load the archive." : search.trim() ? `No ${title.toLowerCase()} match your search.` : `No ${title.toLowerCase()} yet. Items you archive will appear here.`}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
