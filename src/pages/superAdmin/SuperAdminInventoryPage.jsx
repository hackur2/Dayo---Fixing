import AdminPageActions from "../../components/layout/AdminPageActions";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import AddInventoryItemModal from "../../components/superAdmin/inventory/AddInventoryItemModal";
import EditIngredientModal from "../../components/superAdmin/inventory/EditIngredientModal";
import EditMenuItemModal from "../../components/superAdmin/inventory/EditMenuItemModal";
import IngredientSection from "../../components/superAdmin/inventory/IngredientSection";
import InventorySummaryCards from "../../components/superAdmin/inventory/InventorySummaryCards";
import InventoryInsights from "../../components/superAdmin/inventory/InventoryInsights";
import MenuItemSection from "../../components/superAdmin/inventory/MenuItemSection";
import { INVENTORY_STATUS_OPTIONS, INVENTORY_VIEWS } from "../../constants/inventory";
import { SUPER_ADMIN_ROUTES } from "../../constants/routes";
import { useInventoryData } from "../../hooks/useInventoryData";
import { deleteInventoryRecords } from "../../utils/inventoryDeletionUtils";
import { buildInventoryValuation } from "../../utils/inventoryValuationUtils";
import {
  getStockStatus,
} from "../../utils/inventoryUtils";

import "../../styles/superAdminInventory.css";

function SuperAdminInventoryPage() {
  const navigate = useNavigate();
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

  const activeView = initialView;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState("");

  const inventoryIngredients = ingredients;
  const inventoryMenuItems = menuItems;

  const summary = useMemo(() => {
    const lowStockIngredients = inventoryIngredients.filter(
      (item) => getStockStatus(item) === "Low Stock"
    ).length;

    return {
      ingredientCount: inventoryIngredients.length,
      menuItemCount: inventoryMenuItems.length,
      valuation: buildInventoryValuation(inventoryIngredients),
      lowStockIngredients,
    };
  }, [inventoryIngredients, inventoryMenuItems]);

  async function saveIngredientEdit(updatedIngredient) {
    setBulkDeleteError("");
    await updateIngredient(updatedIngredient.id, updatedIngredient);
    setEditingIngredient(null);
  }

  async function saveMenuItemEdit(updatedMenuItem) {
    setBulkDeleteError("");
    await updateMenuItem(updatedMenuItem.id, updatedMenuItem);
    setEditingMenuItem(null);
  }

  async function confirmDeleteSelection(records, recordType, deleteRecord) {
    if (records.length === 0 || isDeleting) return [];
    const description = records.length === 1 ? `“${records[0].name}”` : `${records.length} selected ${recordType}`;
    const details = recordType === "ingredients"
      ? "The ingredient details will be kept in Archive. Ingredients with recipe or stock history cannot be archived."
      : "The menu item details, variants, recipes, and past orders will be preserved. Archived items will leave the active menu.";
    const confirmation = `Move ${description} to Archive? ${details}`;
    if (!window.confirm(confirmation)) return [];

    setIsDeleting(true);
    setBulkDeleteError("");
    try {
      const { deletedIds, errors } = await deleteInventoryRecords(records, deleteRecord);
      if (errors.length > 0) {
        setBulkDeleteError(errors.map(({ name, message }) => `${name}: ${message}`).join(" "));
      } else if (deletedIds.length > 0) {
        const view = recordType === "ingredients" ? INVENTORY_VIEWS.INGREDIENTS : INVENTORY_VIEWS.MENU_ITEMS;
        navigate(`${SUPER_ADMIN_ROUTES.INVENTORY_ARCHIVE}?view=${view}`);
      }
      return deletedIds;
    } finally {
      setIsDeleting(false);
    }
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
            disabled={isDeleting}
            onClick={() => {
              setBulkDeleteError("");
              setIsAddModalOpen(true);
            }}
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

      {(bulkDeleteError || inventoryActionError) && (
        <section className="inventory-message danger" role="alert">
          {bulkDeleteError || inventoryActionError}
        </section>
      )}

      <InventorySummaryCards summary={summary} />

      <InventoryInsights ingredients={inventoryIngredients} menuItems={inventoryMenuItems} />

      {activeView === INVENTORY_VIEWS.INGREDIENTS ? (
        <IngredientSection
          key={initialIngredientStatus}
          initialStatusFilter={initialIngredientStatus}
          ingredients={inventoryIngredients}
          onEditIngredient={setEditingIngredient}
          onDeleteIngredients={(records) => confirmDeleteSelection(records, "ingredients", deleteIngredient)}
          isDeleting={isDeleting}
        />
      ) : (
        <MenuItemSection
          menuItems={inventoryMenuItems}
          ingredients={inventoryIngredients}
          mainCategories={mainCategories}
          subCategories={subCategories}
          onEditMenuItem={setEditingMenuItem}
          onDeleteMenuItems={(records) => confirmDeleteSelection(records, "menu items", deleteMenuItem)}
          isDeleting={isDeleting}
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
