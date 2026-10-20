import { INGREDIENT_CATEGORY_OPTIONS } from "../../../../constants/inventory";
import {
  formatExpirationDate,
  getTodayDateInputValue,
  parseRelativeExpirationInput,
} from "../../../../utils/inventoryUtils";

function AddIngredientFields({ formData, onChange }) {
  function handleRelativeExpirationChange(value) {
    const calculatedDate = parseRelativeExpirationInput(value);

    onChange({
      ...formData,
      expirationInput: value,
      expiresOn: calculatedDate === null ? "" : calculatedDate,
    });
  }

  function handleExactExpirationChange(value) {
    onChange({
      ...formData,
      expirationInput: "",
      expiresOn: value,
    });
  }

  const hasInvalidRelativeInput =
    formData.expirationInput.trim() !== "" &&
    parseRelativeExpirationInput(formData.expirationInput) === null;

  return (
    <>
      <label>
        Ingredient Name
        <input
          type="text"
          value={formData.name}
          onChange={(event) =>
            onChange({
              ...formData,
              name: event.target.value,
            })
          }
          placeholder="Example: Beef"
        />
      </label>

      <label>
        Category
        <select
          value={formData.category}
          onChange={(event) =>
            onChange({
              ...formData,
              category: event.target.value,
            })
          }
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
          value={formData.unit}
          onChange={(event) =>
            onChange({
              ...formData,
              unit: event.target.value,
            })
          }
          placeholder="pcs, kg, packs, ml"
        />
      </label>

      <div className="inventory-modal-two-column">
        <label>
          Current Stock
          <input
            type="number"
            min="0"
            value={formData.currentStock}
            onChange={(event) =>
              onChange({
                ...formData,
                currentStock: event.target.value,
              })
            }
          />
        </label>

        <label>
          Reorder Level
          <input
            type="number"
            min="0"
            value={formData.reorderLevel}
            onChange={(event) =>
              onChange({
                ...formData,
                reorderLevel: event.target.value,
              })
            }
          />
        </label>
      </div>

      <div className="inventory-expiration-card">
        <div className="inventory-expiration-heading">
          <strong>Expires on</strong>
          <span>Optional</span>
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
              value={formData.expiresOn}
              onChange={(event) =>
                handleExactExpirationChange(event.target.value)
              }
            />
          </label>
        </div>

        {hasInvalidRelativeInput ? (
          <small className="inventory-expiration-help error">
            Use a format like 3 days, 2 weeks, 3 months, or 1 year.
          </small>
        ) : formData.expiresOn ? (
          <small className="inventory-expiration-help success">
            Calculated expiration: {formatExpirationDate(formData.expiresOn)}
          </small>
        ) : (
          <small className="inventory-expiration-help">
            Type a relative period or choose a date from the calendar.
          </small>
        )}
      </div>
    </>
  );
}

export default AddIngredientFields;
