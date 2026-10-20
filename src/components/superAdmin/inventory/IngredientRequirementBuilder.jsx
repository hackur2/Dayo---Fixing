function IngredientRequirementBuilder({
  title = "Required Ingredients",
  requirements,
  ingredients,
  onChange,
  onAdd,
  onRemove,
}) {
  return (
    <div className="ingredient-builder">
      <div className="ingredient-builder-header">
        <h3>{title}</h3>

        <button
          type="button"
          className="secondary-button inventory-small-button"
          onClick={onAdd}
        >
          Add Ingredient
        </button>
      </div>

      {requirements.length === 0 && (
        <p className="ingredient-builder-empty">No required ingredients. Add one only if this menu item needs recipe tracking.</p>
      )}

      {requirements.map((requirement, index) => (
        <div
          key={`${requirement.ingredientId}-${index}`}
          className="ingredient-builder-row"
        >
          <select
            value={requirement.ingredientId}
            onChange={(event) =>
              onChange(index, "ingredientId", event.target.value)
            }
          >
            <option value="">Select ingredient</option>
            {ingredients.map((ingredient) => (
              <option key={ingredient.id} value={ingredient.id}>
                {ingredient.name} ({ingredient.unit})
              </option>
            ))}
          </select>

          <input
            type="number"
            min="0"
            step="0.01"
            value={requirement.quantity}
            onChange={(event) =>
              onChange(index, "quantity", event.target.value)
            }
            placeholder="Qty"
          />

          <button type="button" onClick={() => onRemove(index)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

export default IngredientRequirementBuilder;
