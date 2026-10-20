import { useState } from "react";

import IngredientRequirementBuilder from "./IngredientRequirementBuilder";
import MenuImagePicker from "./MenuImagePicker";

function EditMenuItemModal({
  menuItem,
  ingredients,
  mainCategories,
  subCategories,
  onSave,
  onClose,
}) {
  const [variants, setVariants] = useState(() =>
    (menuItem.variants || []).map((variant) => ({
      id: variant.id,
      name: variant.name || "",
      price: String(variant.price ?? ""),
    }))
  );
  const [variantError, setVariantError] = useState("");

  const firstSubCategory =
    subCategories.find(
      (subCategory) =>
        subCategory.mainCategoryId === menuItem.mainCategoryId
    )?.id || "";

  const [formData, setFormData] = useState(() => ({
    name: menuItem.name || "",
    type: menuItem.type || "Ala Carte",
    mainCategoryId: menuItem.mainCategoryId || mainCategories[0]?.id || "food",
    subCategoryId: menuItem.subCategoryId || firstSubCategory,
    price: String(menuItem.price ?? ""),
    imageUrl: menuItem.imageUrl || menuItem.image || "",
    imageFileName: "",
    ingredientRequirements:
      menuItem.ingredientRequirements?.length > 0
        ? menuItem.ingredientRequirements.map((requirement) => ({
            ingredientId: String(requirement.ingredientId ?? ""),
            quantity: String(requirement.quantity),
          }))
        : [],
  }));

  const selectedMainCategory = mainCategories.find(
    (category) => String(category.id) === String(formData.mainCategoryId)
  );
  const isDrinkCategory = selectedMainCategory?.name?.toLowerCase().includes("drink") || false;

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === "mainCategoryId") {
      setVariantError("");
      const firstMatchingSubCategory =
        subCategories.find(
          (subCategory) => subCategory.mainCategoryId === value
        )?.id || "";

      setFormData((currentForm) => ({
        ...currentForm,
        mainCategoryId: value,
        subCategoryId: firstMatchingSubCategory,
      }));

      return;
    }

    setFormData((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function handleImageChange(imageData) {
    setFormData((currentForm) => ({
      ...currentForm,
      ...imageData,
    }));
  }

  function updateRequirement(index, field, value) {
    setFormData((currentForm) => ({
      ...currentForm,
      ingredientRequirements: currentForm.ingredientRequirements.map(
        (requirement, requirementIndex) =>
          requirementIndex === index
            ? { ...requirement, [field]: value }
            : requirement
      ),
    }));
  }

  function addRequirement() {
    setFormData((currentForm) => ({
      ...currentForm,
      ingredientRequirements: [
        ...currentForm.ingredientRequirements,
        { ingredientId: ingredients[0]?.id || "", quantity: "" },
      ],
    }));
  }

  function removeRequirement(index) {
    setFormData((currentForm) => ({
      ...currentForm,
      ingredientRequirements: currentForm.ingredientRequirements.filter(
        (_, requirementIndex) => requirementIndex !== index
      ),
    }));
  }

  function updateVariant(index, field, value) {
    setVariants((currentVariants) => currentVariants.map((variant, variantIndex) =>
      variantIndex === index ? { ...variant, [field]: value } : variant
    ));
    setVariantError("");
  }

  function addVariant() {
    setVariants((currentVariants) => [...currentVariants, { name: "", price: "" }]);
    setVariantError("");
  }

  function removeVariant(index) {
    setVariants((currentVariants) => currentVariants.filter((_, variantIndex) => variantIndex !== index));
    setVariantError("");
  }

  function getVariantKey(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!formData.name.trim() || formData.price === "") return;

    if (isDrinkCategory && variants.some((variant) =>
      !variant.name.trim() ||
      String(variant.price).trim() === "" ||
      !Number.isFinite(Number(variant.price)) ||
      Number(variant.price) < 0
    )) {
      setVariantError("Enter a size and a valid price for each variant.");
      return;
    }

    const normalizedVariants = variants.map((variant) => ({
      ...variant,
      name: variant.name.trim(),
      variantKey: getVariantKey(variant.name),
      price: Number(variant.price),
    }));
    if (isDrinkCategory && normalizedVariants.some((variant) => !variant.name || !variant.variantKey || !Number.isFinite(variant.price))) {
      setVariantError("Enter a size and a valid price for each variant.");
      return;
    }
    if (isDrinkCategory && new Set(normalizedVariants.map((variant) => variant.variantKey)).size !== normalizedVariants.length) {
      setVariantError("Each size must have a unique name.");
      return;
    }

    const validRequirements = formData.ingredientRequirements.filter(
      (requirement) =>
        String(requirement.ingredientId ?? "").trim() !== "" &&
        String(requirement.quantity ?? "").trim() !== "" &&
        Number.isFinite(Number(requirement.ingredientId)) &&
        Number.isFinite(Number(requirement.quantity))
    );

    onSave({
      ...menuItem,
      name: formData.name.trim(),
      type: formData.type,
      mainCategoryId: formData.mainCategoryId,
      subCategoryId: formData.subCategoryId,
      price: Number(formData.price),
      imageUrl: formData.imageUrl,
      variants: isDrinkCategory ? normalizedVariants : menuItem.variants,
      ingredientRequirements: validRequirements.map((requirement) => ({
        ingredientId: Number(requirement.ingredientId),
        quantity: Number(requirement.quantity),
      })),
    });
  }

  return (
    <div className="inventory-modal-backdrop">
      <section className="inventory-modal inventory-edit-modal">
        <div className="inventory-modal-header">
          <div>
            <p className="admin-eyebrow">Menu Update</p>
            <h2>Edit Menu Item</h2>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="inventory-modal-form" onSubmit={handleSubmit}>
          <label>
            Menu Item Name
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
            />
          </label>

          <div className="inventory-modal-two-column">
            <label>
              Type
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
              >
                <option value="Ala Carte">Ala Carte</option>
                <option value="Combo">Combo</option>
              </select>
            </label>

            <label>
              Price
              <input
                type="number"
                min="0"
                name="price"
                value={formData.price}
                onChange={handleChange}
              />
            </label>
          </div>

          {isDrinkCategory && <section className="inventory-variant-builder">
            <div className="inventory-variant-header">
              <div>
                <h3>Size Variants</h3>
                <p>Set the size label and price customers can choose.</p>
              </div>
              <button type="button" className="inventory-variant-add" onClick={addVariant}>
                Add Size
              </button>
            </div>

            {variants.length === 0 ? (
              <p className="inventory-variant-empty">No size variants. This item uses its regular price.</p>
            ) : variants.map((variant, index) => (
              <div className="inventory-variant-row" key={variant.id ?? `new-${index}`}>
                <label>
                  Size
                  <input
                    type="text"
                    value={variant.name}
                    placeholder="12 oz"
                    onChange={(event) => updateVariant(index, "name", event.target.value)}
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
                    onChange={(event) => updateVariant(index, "price", event.target.value)}
                  />
                </label>
                <button type="button" className="inventory-variant-remove" onClick={() => removeVariant(index)}>
                  Remove
                </button>
              </div>
            ))}
            {variantError && <p className="inventory-variant-error" role="alert">{variantError}</p>}
          </section>}

          <div className="inventory-modal-two-column">
            <label>
              Main Category
              <select
                name="mainCategoryId"
                value={formData.mainCategoryId}
                onChange={handleChange}
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
                name="subCategoryId"
                value={formData.subCategoryId}
                onChange={handleChange}
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

          <MenuImagePicker
            imageUrl={formData.imageUrl}
            imageFileName={formData.imageFileName}
            onChange={handleImageChange}
          />

          <IngredientRequirementBuilder
            requirements={formData.ingredientRequirements}
            ingredients={ingredients}
            onChange={updateRequirement}
            onAdd={addRequirement}
            onRemove={removeRequirement}
          />

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

export default EditMenuItemModal;
