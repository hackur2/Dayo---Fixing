import AdminPageActions from "../../components/layout/AdminPageActions";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import AddInventoryItemModal from "../../components/superAdmin/inventory/AddInventoryItemModal";
import EditIngredientModal from "../../components/superAdmin/inventory/EditIngredientModal";
import EditMenuItemModal from "../../components/superAdmin/inventory/EditMenuItemModal";
import IngredientSection from "../../components/superAdmin/inventory/IngredientSection";
import InventorySummaryCards from "../../components/superAdmin/inventory/InventorySummaryCards";
import InventoryViewToggle from "../../components/superAdmin/inventory/InventoryViewToggle";
import MenuItemSection from "../../components/superAdmin/inventory/MenuItemSection";
import { INVENTORY_STATUS_OPTIONS, INVENTORY_VIEWS } from "../../constants/inventory";
import { useInventoryData } from "../../hooks/useInventoryData";
import {
  getMenuItemAvailability,
  getStockStatus,
} from "../../utils/inventoryUtils";

import "../../styles/superAdminInventory.css";

function SuperAdminInventoryPage() {
  const [searchParams] = useSearchParams();
  const requestedView = searchParams.get("view");
  const requestedStatus = searchParams.get("status");
  const initialView = requestedView === INVENTORY_VIEWS.MENU_ITEMS
    ? INVENTORY_VIEWS.MENU_ITEMS
    : INVENTORY_VIEWS.INGREDIENTS;
  const initialIngredientStatus = INVENTORY_STATUS_OPTIONS.includes(requestedStatus)
    ? requestedStatus
    : "All";

  const {
    ingredients,
    mainCategories,
    subCategories,
    menuItems,
    isInventoryLoading,
    inventoryError,
    inventoryActionError,
    addSubCategory,
    addIngredient,
    addAlaCarteMenuItem,
    addComboMenuItem,
    updateIngredient,
    updateMenuItem,
    deleteIngredient,
    deleteMenuItem,
  } = useInventoryData();

  const [activeView, setActiveView] = useState(initialView);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [editingMenuItem, setEditingMenuItem] = useState(null);

  const inventoryIngredients = ingredients;
  const inventoryMenuItems = menuItems;

  const summary = useMemo(() => {
    const availableMenuItems = inventoryMenuItems.filter(
      (item) =>
        getMenuItemAvailability(item, inventoryIngredients) === "Available"
    ).length;

    const lowStockIngredients = inventoryIngredients.filter(
      (item) => getStockStatus(item) === "Low Stock"
    ).length;

    return {
      ingredientCount: inventoryIngredients.length,
      menuItemCount: inventoryMenuItems.length,
      availableMenuItems,
      lowStockIngredients,
    };
  }, [inventoryIngredients, inventoryMenuItems]);

  async function saveIngredientEdit(updatedIngredient) {
    await updateIngredient(updatedIngredient.id, updatedIngredient);
    setEditingIngredient(null);
  }

  async function saveMenuItemEdit(updatedMenuItem) {
    await updateMenuItem(updatedMenuItem.id, updatedMenuItem);
    setEditingMenuItem(null);
  }

  async function confirmDeleteIngredient(ingredient) {
    if (!window.confirm(`Delete ingredient “${ingredient.name}”? This cannot be undone. Ingredients with recipe or stock history cannot be deleted.`)) return;
    try { await deleteIngredient(ingredient.id); }
    catch (error) { console.error("Unable to delete ingredient:", error.message); }
  }

  async function confirmDeleteMenuItem(menuItem) {
    if (!window.confirm(`Permanently delete “${menuItem.name}” from Supabase? Past order details will remain, but its variants and recipe links will be deleted.`)) return;
    try { await deleteMenuItem(menuItem.id); }
    catch (error) { console.error("Unable to delete menu item:", error.message); }
  }

  if (isInventoryLoading) {
    return (
      <section className="admin-page">
        <div className="admin-page-heading">
          <div>
            
            <h1>Inventory Management</h1>
            <p>Loading inventory records...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow"></p>
          <h1>Inventory Management</h1>
          <p></p>
        </div>

        <AdminPageActions className="inventory-heading-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => setIsAddModalOpen(true)}
          >
            Add Item
          </button>
        </AdminPageActions>
      </div>

      {inventoryError && (
        <section className="inventory-message warning">
          {inventoryError}
        </section>
      )}

      {inventoryActionError && (
        <section className="inventory-message danger">
          {inventoryActionError}
        </section>
      )}

      <InventorySummaryCards summary={summary} />

      <InventoryViewToggle
        activeView={activeView}
        onChange={setActiveView}
      />

      {activeView === INVENTORY_VIEWS.INGREDIENTS ? (
        <IngredientSection
          initialStatusFilter={initialIngredientStatus}
          ingredients={inventoryIngredients}
          onEditIngredient={setEditingIngredient}
          onDeleteIngredient={confirmDeleteIngredient}
        />
      ) : (
        <MenuItemSection
          menuItems={inventoryMenuItems}
          ingredients={inventoryIngredients}
          mainCategories={mainCategories}
          subCategories={subCategories}
          onEditMenuItem={setEditingMenuItem}
          onDeleteMenuItem={confirmDeleteMenuItem}
        />
      )}

      {isAddModalOpen && (
        <AddInventoryItemModal
          ingredients={inventoryIngredients}
          mainCategories={mainCategories}
          subCategories={subCategories}
          menuItems={inventoryMenuItems}
          onAddSubCategory={addSubCategory}
          onAddIngredient={addIngredient}
          onAddAlaCarte={addAlaCarteMenuItem}
          onAddCombo={addComboMenuItem}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {editingIngredient && (
        <EditIngredientModal
          ingredient={editingIngredient}
          onSave={saveIngredientEdit}
          onClose={() => setEditingIngredient(null)}
        />
      )}

      {editingMenuItem && (
        <EditMenuItemModal
          menuItem={editingMenuItem}
          ingredients={inventoryIngredients}
          mainCategories={mainCategories}
          subCategories={subCategories}
          onSave={saveMenuItemEdit}
          onClose={() => setEditingMenuItem(null)}
        />
      )}
    </section>
  );
}

export default SuperAdminInventoryPage;
