import { useState } from "react";
import { Link } from "react-router";

import AdminPageActions from "../../components/layout/AdminPageActions";
import SupplierModal from "../../components/superAdmin/suppliers/SupplierModal";
import { SUPER_ADMIN_ROUTES } from "../../constants/routes";
import { useSupplierData } from "../../hooks/useSupplierData";

import "../../styles/superAdminSupplier.css";

function SuperAdminSupplierPage() {
  const {
    suppliers,
    isLoading,
    loadError,
    isSaving,
    isDeleting,
    reloadSuppliers,
    createSupplier,
    updateSupplier,
    deleteSuppliers,
  } = useSupplierData();
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeModal, setActiveModal] = useState(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const allSelected = suppliers.length > 0 && selectedIds.length === suppliers.length;
  const isBusy = isSaving || isDeleting;

  function toggleSupplier(id) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]
    );
  }

  function openEditModal(supplier) {
    if (isBusy) return;
    setNotice("");
    setActionError("");
    setActiveModal({ supplier });
  }

  async function saveSupplier(values) {
    const editingId = activeModal.supplier?.id;
    const savedSupplier = editingId != null
      ? await updateSupplier(editingId, values)
      : await createSupplier(values);
    setActiveModal(null);
    setNotice(`${savedSupplier.displayId} ${editingId != null ? "updated" : "added"}.`);
  }

  async function deleteSelectedSuppliers() {
    if (selectedIds.length === 0 || isBusy) return;
    setNotice("");
    setActionError("");
    try {
      const deletedIds = await deleteSuppliers(selectedIds);
      setSelectedIds((current) => current.filter((id) => !deletedIds.includes(id)));
      setNotice(`${deletedIds.length} supplier${deletedIds.length === 1 ? "" : "s"} deleted.`);
      if (deletedIds.length < selectedIds.length) {
        setActionError("Some selected suppliers were not deleted. Refresh the page and check your account permissions.");
      }
    } catch (error) {
      setActionError(error.message || "Unable to delete suppliers. Please try again.");
    }
  }

  return (
    <section className="admin-page supplier-page">
      <div className="admin-page-heading">
        <div>
          <h1>Supplier</h1>
          <p>Local suppliers and their ingredients.</p>
        </div>

        <AdminPageActions className="supplier-page-actions">
          <Link
            className="secondary-button supplier-back-link"
            to={SUPER_ADMIN_ROUTES.INVENTORY}
          >
            Back to Inventory
          </Link>
          <button
            type="button"
            className="primary-button"
            disabled={isLoading || Boolean(loadError) || isBusy}
            onClick={() => {
              setNotice("");
              setActionError("");
              setActiveModal({ supplier: null });
            }}
          >
            Add Supplier
          </button>
        </AdminPageActions>
      </div>

      {notice && <p className="supplier-notice" role="status">{notice}</p>}
      {loadError && (
        <div className="supplier-error" role="alert">
          <p>Unable to load suppliers: {loadError}</p>
          <button type="button" className="secondary-button" onClick={reloadSuppliers}>Retry</button>
        </div>
      )}
      {actionError && <p className="supplier-error" role="alert">{actionError}</p>}

      <section className="supplier-table-card" aria-labelledby="supplier-directory-heading">
        <div className="supplier-table-header">
          <div>
            <h2 id="supplier-directory-heading">Supplier Directory</h2>
            
           
          </div>
          <button
            type="button"
            className="primary-button supplier-delete-button"
            disabled={selectedIds.length === 0 || isLoading || Boolean(loadError) || isBusy}
            onClick={deleteSelectedSuppliers}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>

        <div
          className="supplier-table-scroll"
          role="region"
          aria-labelledby="supplier-directory-heading"
          tabIndex={0}
        >
          <table className="supplier-table" aria-label="Supplier directory">
            <thead>
              <tr>
                <th scope="col" className="supplier-checkbox-cell">
                  <input
                    type="checkbox"
                    aria-label="Select all suppliers"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = selectedIds.length > 0 && !allSelected;
                    }}
                    disabled={suppliers.length === 0 || isLoading || Boolean(loadError) || isBusy}
                    onChange={() => setSelectedIds(allSelected ? [] : suppliers.map((supplier) => supplier.id))}
                  />
                </th>
                <th scope="col">ID</th>
                <th scope="col">Name</th>
                <th scope="col">Ingredient</th>
                <th scope="col">Mobile</th>
                <th scope="col">Address</th>
              </tr>
            </thead>

            <tbody>
              {suppliers.map((supplier) => (
                <tr
                  key={supplier.id}
                  className={selectedIds.includes(supplier.id) ? "supplier-row selected" : "supplier-row"}
                  tabIndex={isBusy ? -1 : 0}
                  aria-label={`Edit supplier ${supplier.name}`}
                  onClick={() => openEditModal(supplier)}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      openEditModal(supplier);
                    }
                  }}
                >
                  <td className="supplier-checkbox-cell" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${supplier.name}`}
                      checked={selectedIds.includes(supplier.id)}
                      disabled={isBusy}
                      onChange={() => toggleSupplier(supplier.id)}
                    />
                  </td>
                  <td>{supplier.displayId}</td>
                  <td><strong>{supplier.name}</strong></td>
                  <td>{supplier.ingredient}</td>
                  <td>{supplier.mobile}</td>
                  <td>{supplier.address}</td>
                </tr>
              ))}
              {isLoading || loadError ? (
                <tr>
                  <td colSpan={6} className="supplier-empty-state" role="status">
                    {isLoading ? "Loading suppliers..." : "Unable to load suppliers. Use Retry to try again."}
                  </td>
                </tr>
              ) : suppliers.length === 0 && (
                <tr>
                  <td colSpan={6} className="supplier-empty-state">No suppliers yet. Use Add Supplier to create one.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {activeModal && (
        <SupplierModal
          supplier={activeModal.supplier}
          supplierId={activeModal.supplier?.displayId || "Assigned when saved"}
          isSaving={isSaving}
          onSave={saveSupplier}
          onClose={() => { if (!isSaving) setActiveModal(null); }}
        />
      )}
    </section>
  );
}

export default SuperAdminSupplierPage;
