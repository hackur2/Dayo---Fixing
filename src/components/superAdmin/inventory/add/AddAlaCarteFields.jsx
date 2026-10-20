import IngredientRequirementBuilder from "../IngredientRequirementBuilder";
import MenuImagePicker from "../MenuImagePicker";

function AddAlaCarteFields({
  formData,
  isDrinkCategory,
  variantError,
  ingredients,
  mainCategories,
  subCategories,
  onChange,
  onRequirementChange,
  onAddRequirement,
  onRemoveRequirement,
  onVariantChange,
  onAddVariant,
  onRemoveVariant,
}) {
  function handleMainCategoryChange(mainCategoryId) {
    const firstSubCategoryId =
      subCategories.find(
        (subCategory) => subCategory.mainCategoryId === mainCategoryId
      )?.id || "";
    const selectedCategoryName = mainCategories
      .find((category) => String(category.id) === String(mainCategoryId))
      ?.name?.toLowerCase() || "";

    onChange({
      ...formData,
      mainCategoryId,
      subCategoryId: firstSubCategoryId,
      variants: selectedCategoryName.includes("drink") ? formData.variants : [],
    });
  }

  function handleImageChange(imageData) {
    onChange({
      ...formData,
      ...imageData,
    });
  }

  return (
    <>
      <label>
        Ala Carte Name
        <input
          type="text"
          value={formData.name}
          onChange={(event) =>
            onChange({
              ...formData,
              name: event.target.value,
            })
          }
          placeholder="Example: Beef Pho"
        />
      </label>

      <div className="inventory-modal-two-column">
        <label>
          Main Category
          <select
            value={formData.mainCategoryId}
            onChange={(event) =>
              handleMainCategoryChange(event.target.value)
            }
          >
            {mainCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Subcategory
          <select
            value={formData.subCategoryId}
            onChange={(event) =>
              onChange({
                ...formData,
                subCategoryId: event.target.value,
              })
            }
          >
            {subCategories
              .filter(
                (subCategory) =>
                  subCategory.mainCategoryId === formData.mainCategoryId
              )
              .map((subCategory) => (
                <option key={subCategory.id} value={subCategory.id}>
                  {subCategory.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      {isDrinkCategory ? (
        <section className="inventory-variant-builder">
          <div className="inventory-variant-header">
            <div>
              <h3>Size Variants</h3>
              <p>Add each drink size and its price.</p>
            </div>
            <button type="button" className="inventory-variant-add" onClick={onAddVariant}>
              Add Size
            </button>
          </div>

          {formData.variants.length === 0 ? (
            <p className="inventory-variant-empty">Add at least one size and price.</p>
          ) : formData.variants.map((variant, index) => (
            <div className="inventory-variant-row" key={`new-drink-variant-${index}`}>
              <label>
                Size
                <input
                  type="text"
                  value={variant.name}
                  placeholder="12 oz"
                  onChange={(event) => onVariantChange(index, "name", event.target.value)}
                />
              </label>
              <label>
                Price
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={variant.price}
                  placeholder="65.00"
                  onChange={(event) => onVariantChange(index, "price", event.target.value)}
                />
              </label>
              <button type="button" className="inventory-variant-remove" onClick={() => onRemoveVariant(index)}>
                Remove
              </button>
            </div>
          ))}
          {variantError && <p className="inventory-variant-error" role="alert">{variantError}</p>}
        </section>
      ) : (
        <label>
          Price
          <input
            type="number"
            min="0"
            value={formData.price}
            onChange={(event) =>
              onChange({
                ...formData,
                price: event.target.value,
              })
            }
          />
        </label>
      )}

      <MenuImagePicker
        imageUrl={formData.imageUrl}
        imageFileName={formData.imageFileName}
        onChange={handleImageChange}
      />

      <IngredientRequirementBuilder
        title="Ingredients Used"
        requirements={formData.ingredientRequirements}
        ingredients={ingredients}
        onChange={onRequirementChange}
        onAdd={onAddRequirement}
        onRemove={onRemoveRequirement}
      />
    </>
  );
}

export default AddAlaCarteFields;
