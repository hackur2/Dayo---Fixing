import { useState } from "react";

import { INGREDIENT_CATEGORY_OPTIONS } from "../../../constants/inventory";
import IngredientReorderFields from "./IngredientReorderFields";
import IngredientUnitSelect from "./IngredientUnitSelect";
import { isIngredientUnit, normalizeIngredientUnit } from "../../../utils/ingredientUnitUtils";
import { calculateIngredientReorderPoint } from "../../../utils/ingredientReorderUtils";
import {
  formatExpirationDate,
  getInventoryTimestamp,
  parseRelativeExpirationInput,
} from "../../../utils/inventoryUtils";

function EditIngredientModal({ ingredient, onSave, onClose }) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [formData, setFormData] = useState(() => ({
    name: ingredient.name || "",
    category: ingredient.category || "Food Ingredient",
    unit: isIngredientUnit(normalizeIngredientUnit(ingredient.unit)) ? normalizeIngredientUnit(ingredient.unit) : "",
    currentStock: String(ingredient.currentStock ?? ""),
    expirationInput: "",
    expiresOn: ingredient.expiresOn || "",
  }));

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentForm) => ({
      ...currentForm,
      [name]: value,
      ...(name === "expiresOn" ? { expirationInput: "" } : {}),
    }));
  }

  function handleRelativeExpirationChange(value) {
    const calculatedDate = parseRelativeExpirationInput(value);

    setFormData((currentForm) => ({
      ...currentForm,
      expirationInput: value,
      expiresOn: calculatedDate === null ? "" : calculatedDate,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSaving) return;

    const hasInvalidExpiration =
      formData.expirationInput.trim() !== "" && formData.expiresOn === "";

    const isIncomplete =
      !formData.name.trim() ||
      !isIngredientUnit(formData.unit) ||
      formData.currentStock === "" ||
      hasInvalidExpiration;

    if (isIncomplete) return;

    setIsSaving(true);
    setSaveError("");
    try {
      await onSave({
        ...ingredient,
        name: formData.name.trim(),
        category: formData.category,
        unit: formData.unit,
        currentStock: Number(formData.currentStock),
        reorderLevel: calculateIngredientReorderPoint(ingredient.quantitySold30Days ?? 0).reorderLevel,
        expiresOn: formData.expiresOn || "",
        lastUpdated: getInventoryTimestamp(),
      });
    } catch (error) {
      setSaveError(error.message || "Unable to save the ingredient. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const hasInvalidRelativeInput =
    formData.expirationInput.trim() !== "" &&
    parseRelativeExpirationInput(formData.expirationInput) === null;

  return (
    <div className="inventory-modal-backdrop">
      <section className="inventory-modal inventory-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-ingredient-title">
        <div className="inventory-modal-header">
          <div>
            <p className="admin-eyebrow">Inventory Update</p>
            <h2 id="edit-ingredient-title">Edit Ingredient</h2>
          </div>

          <button type="button" onClick={onClose} disabled={isSaving} aria-label="Close ingredient editor">
            ×
          </button>
        </div>

        <form className="inventory-modal-form" onSubmit={handleSubmit} aria-busy={isSaving}>
          {saveError && <p className="inventory-message danger" role="alert">{saveError}</p>}
          <fieldset className="inventory-edit-fields" disabled={isSaving}>
          <label>
            Ingredient Name
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
            />
          </label>

          <label>
            Category
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
            >
              {INGREDIENT_CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <IngredientUnitSelect value={formData.unit} onChange={handleChange} />
          {!isIngredientUnit(normalizeIngredientUnit(ingredient.unit)) && <small className="inventory-expiration-help">Existing quantities are recorded in {ingredient.unit || "an unspecified unit"}. Convert the stock, recipes, and sales history together before saving a different unit.</small>}

          <div className="inventory-stock-field">
            <label>
              Current Stock
              <input
                type="number"
                min="0"
                step="0.001"
                required
                name="currentStock"
                value={formData.currentStock}
                onChange={handleChange}
              />
            </label>

          </div>

          <IngredientReorderFields quantitySold30Days={ingredient.quantitySold30Days ?? 0} unit={formData.unit || "units"} />

          <div className="inventory-expiration-card">
            <div className="inventory-expiration-heading">
              <strong>Expires on</strong>
              <span></span>
            </div>

            <div className="inventory-expiration-grid">
              <label>
                Relative time
                <input
                  type="text"
                  value={formData.expirationInput}
                  onChange={(event) =>
                    handleRelativeExpirationChange(event.target.value)
                  }
                  placeholder="Example: 3 months or 14 days"
                />
              </label>

              <label>
                Exact date
                <input
                  type="date"
                  name="expiresOn"
                  value={formData.expiresOn}
                  onChange={handleChange}
                />
              </label>
            </div>

            {hasInvalidRelativeInput ? (
              <small className="inventory-expiration-help error">
                Use a format like 3 days, 2 weeks, 3 months, or 1 year.
              </small>
            ) : formData.expiresOn ? (
              <small className="inventory-expiration-help success">
                Expiration date: {formatExpirationDate(formData.expiresOn)}
              </small>
            ) : (
              <small className="inventory-expiration-help">
                Type a relative period or choose a date from the calendar.
              </small>
            )}
          </div>

          </fieldset>
          <div className="inventory-modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>

            <button type="submit" className="primary-button" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default EditIngredientModal;
