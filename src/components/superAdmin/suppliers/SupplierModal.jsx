import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supplierService } from "../../../services/supplierService";

const SUPPLIER_FIELDS = [
  { name: "name", label: "Name", placeholder: "Enter supplier name" },
  { name: "ingredient", label: "Ingredient" },
  { name: "mobile", label: "Mobile", placeholder: "e.g. 0917 123 4567", type: "tel" },
  { name: "address", label: "Address", placeholder: "Enter complete address" },
];

function SupplierModal({ supplier, supplierId, isSaving = false, onSave, onClose }) {
  const dialogRef = useRef(null);
  const [formData, setFormData] = useState(() =>
    Object.fromEntries(SUPPLIER_FIELDS.map(({ name }) => [name, supplier?.[name] || ""]))
  );
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [isIngredientsLoading, setIsIngredientsLoading] = useState(true);
  const [ingredientError, setIngredientError] = useState("");
  const [ingredientLoadVersion, setIngredientLoadVersion] = useState(0);
  const isEditing = Boolean(supplier);
  const canChooseIngredient = !isIngredientsLoading && !ingredientError && ingredients.length > 0;
  const hasUnavailableIngredient = formData.ingredient &&
    !ingredients.some((ingredient) => ingredient.name === formData.ingredient);

  useEffect(() => {
    let cancelled = false;
    supplierService.getIngredientOptions()
      .then((rows) => { if (!cancelled) setIngredients(rows); })
      .catch((error) => {
        if (!cancelled) setIngredientError(error.message || "Unable to load Inventory ingredients.");
      })
      .finally(() => { if (!cancelled) setIsIngredientsLoading(false); });
    return () => { cancelled = true; };
  }, [ingredientLoadVersion]);

  function retryIngredients() {
    setIsIngredientsLoading(true);
    setIngredientError("");
    setIngredientLoadVersion((version) => version + 1);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    dialog.querySelector('[name="name"]').focus();
    document.body.style.overflow = "hidden";

    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSaving || !canChooseIngredient) return;
    setSaveError("");
    const values = Object.fromEntries(
      SUPPLIER_FIELDS.map(({ name }) => [name, formData[name].trim()])
    );
    const nextErrors = {};

    for (const { name, label } of SUPPLIER_FIELDS) {
      if (!values[name]) nextErrors[name] = `${label} is required.`;
    }

    if (values.ingredient && !ingredients.some((ingredient) => ingredient.name === values.ingredient)) {
      nextErrors.ingredient = "Choose an ingredient from the Inventory list.";
    }

    if (values.mobile && !/^(?:09\d{9}|\+639\d{9})$/.test(values.mobile.replace(/[\s()-]/g, ""))) {
      nextErrors.mobile = "Enter a Philippine mobile number, e.g. 0917 123 4567 or +63 917 123 4567.";
    }

    setErrors(nextErrors);
    const firstInvalidField = Object.keys(nextErrors)[0];
    if (firstInvalidField) {
      event.currentTarget.elements.namedItem(firstInvalidField).focus();
      return;
    }

    try {
      await onSave(values);
    } catch (error) {
      setSaveError(error.message || "Unable to save supplier. Please try again.");
    }
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className="supplier-modal"
      aria-labelledby="supplier-modal-title"
      aria-describedby="supplier-modal-help"
      onCancel={(event) => {
        event.preventDefault();
        if (!isSaving) onClose();
      }}
    >
      <div className="supplier-modal-header">
        <div>
          <h2 id="supplier-modal-title">{isEditing ? "Edit Supplier" : "Add Supplier"}</h2>
          <p id="supplier-modal-help">All fields are required. The ID is assigned automatically.</p>
        </div>
        <button
          type="button"
          className="supplier-modal-close"
          onClick={onClose}
          disabled={isSaving}
          aria-label="Close supplier form"
        >
          ×
        </button>
      </div>

      <form className="supplier-modal-form" onSubmit={handleSubmit} noValidate aria-busy={isSaving}>
        <div className="supplier-id-preview">ID: <strong>{supplierId}</strong></div>
        {saveError && <p className="supplier-save-error" role="alert">{saveError}</p>}

        {SUPPLIER_FIELDS.map(({ name, label, placeholder, type }) => (
          <div className="supplier-modal-field" key={name}>
            <label htmlFor={`supplier-${name}`}>
              <span>{label} <span aria-hidden="true">*</span></span>
              {name === "ingredient" ? (
                <select
                  id={`supplier-${name}`}
                  name={name}
                  value={formData[name]}
                  onChange={handleChange}
                  required
                  disabled={isSaving || !canChooseIngredient}
                  aria-invalid={Boolean(errors[name])}
                  aria-describedby={`supplier-ingredient-help${errors[name] ? ` supplier-${name}-error` : ""}`}
                >
                  <option value="">{isIngredientsLoading ? "Loading ingredients..." : "Select an ingredient"}</option>
                  {hasUnavailableIngredient && <option value={formData.ingredient} disabled>{formData.ingredient} (choose an Inventory ingredient)</option>}
                  {ingredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.name}>{ingredient.name}</option>
                  ))}
                </select>
              ) : name === "address" ? (
                <textarea
                  id={`supplier-${name}`}
                  name={name}
                  value={formData[name]}
                  onChange={handleChange}
                  placeholder={placeholder}
                  rows={3}
                  required
                  disabled={isSaving}
                  aria-invalid={Boolean(errors[name])}
                  aria-describedby={errors[name] ? `supplier-${name}-error` : undefined}
                />
              ) : (
                <input
                  id={`supplier-${name}`}
                  name={name}
                  type={type || "text"}
                  value={formData[name]}
                  onChange={handleChange}
                  placeholder={placeholder}
                  required
                  disabled={isSaving}
                  aria-invalid={Boolean(errors[name])}
                  aria-describedby={errors[name] ? `supplier-${name}-error` : undefined}
                />
              )}
            </label>
            {name === "ingredient" && (
              <div className="supplier-ingredient-help" id="supplier-ingredient-help">
                {ingredientError ? (
                  <div className="supplier-ingredient-error" role="alert">
                    <p>Unable to load Inventory ingredients: {ingredientError}</p>
                    <button type="button" className="secondary-button" onClick={retryIngredients}>Retry</button>
                  </div>
                ) : (
                  <p>{isIngredientsLoading ? "Loading ingredients from Inventory..." : ingredients.length === 0 ? "No ingredients yet. Add ingredients in Inventory first." : "Choose from up to 10 Inventory ingredients."}</p>
                )}
              </div>
            )}
            {errors[name] && (
              <small className="supplier-field-error" id={`supplier-${name}-error`} role="alert">
                {errors[name]}
              </small>
            )}
          </div>
        ))}

        <div className="supplier-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="submit" className="primary-button" disabled={isSaving || !canChooseIngredient}>
            {isSaving ? "Saving..." : isEditing ? "Save Changes" : "Save Supplier"}
          </button>
        </div>
      </form>
    </dialog>,
    document.body
  );
}

export default SupplierModal;
