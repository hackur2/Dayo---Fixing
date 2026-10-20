import { useState } from "react";

import { INGREDIENT_CATEGORY_OPTIONS } from "../../../constants/inventory";
import {
  formatExpirationDate,
  getInventoryTimestamp,
  getTodayDateInputValue,
  parseRelativeExpirationInput,
} from "../../../utils/inventoryUtils";

function EditIngredientModal({ ingredient, onSave, onClose }) {
  const [formData, setFormData] = useState(() => ({
    name: ingredient.name || "",
    category: ingredient.category || "Food Ingredient",
    unit: ingredient.unit || "pcs",
    currentStock: String(ingredient.currentStock ?? ""),
    reorderLevel: String(ingredient.reorderLevel ?? ""),
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

  function handleSubmit(event) {
    event.preventDefault();

    const hasInvalidExpiration =
      formData.expirationInput.trim() !== "" && formData.expiresOn === "";

    const isIncomplete =
      !formData.name.trim() ||
      !formData.unit.trim() ||
      formData.currentStock === "" ||
      formData.reorderLevel === "" ||
      hasInvalidExpiration;

    if (isIncomplete) return;

    onSave({
      ...ingredient,
      name: formData.name.trim(),
      category: formData.category,
      unit: formData.unit.trim(),
      currentStock: Number(formData.currentStock),
      reorderLevel: Number(formData.reorderLevel),
      expiresOn: formData.expiresOn || "",
      lastUpdated: getInventoryTimestamp(),
    });
  }

  const hasInvalidRelativeInput =
    formData.expirationInput.trim() !== "" &&
    parseRelativeExpirationInput(formData.expirationInput) === null;

  return (
    <div className="inventory-modal-backdrop">
      <section className="inventory-modal inventory-edit-modal">
        <div className="inventory-modal-header">
          <div>
            <p className="admin-eyebrow">Inventory Update</p>
            <h2>Edit Ingredient</h2>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="inventory-modal-form" onSubmit={handleSubmit}>
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

          <label>
            Unit of Measure
            <input
              type="text"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              placeholder="pcs, kg, packs, ml"
            />
          </label>

          <div className="inventory-modal-two-column">
            <label>
              Current Stock
              <input
                type="number"
                min="0"
                name="currentStock"
                value={formData.currentStock}
                onChange={handleChange}
              />
            </label>

            <label>
              Reorder Level
              <input
                type="number"
                min="0"
                name="reorderLevel"
                value={formData.reorderLevel}
                onChange={handleChange}
              />
            </label>
          </div>

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
                  min={getTodayDateInputValue()}
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

          <div className="inventory-modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>

            <button type="submit" className="primary-button">
              Save Changes
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default EditIngredientModal;
