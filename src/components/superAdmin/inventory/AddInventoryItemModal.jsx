import { useState } from "react";

import { ADD_TYPES } from "../../../constants/inventory";
import AddAlaCarteFields from "./add/AddAlaCarteFields";
import AddComboFields from "./add/AddComboFields";
import AddIngredientFields from "./add/AddIngredientFields";
import AddSubcategoryFields from "./add/AddSubcategoryFields";

function AddInventoryItemModal({
  ingredients,
  mainCategories,
  subCategories,
  menuItems,
  onAddSubCategory,
  onAddIngredient,
  onAddAlaCarte,
  onAddCombo,
  onClose,
}) {
  const firstMainCategoryId = mainCategories[0]?.id || "food";
  const firstSubCategoryId =
    subCategories.find(
      (subCategory) => subCategory.mainCategoryId === firstMainCategoryId
    )?.id || "";
  const firstIngredientId = ingredients[0]?.id || "";

  const [addType, setAddType] = useState(ADD_TYPES.SUBCATEGORY);
  const [alaCarteVariantError, setAlaCarteVariantError] = useState("");

  const [subcategoryForm, setSubcategoryForm] = useState({
    mainCategoryId: firstMainCategoryId,
    name: "",
  });

  const [ingredientForm, setIngredientForm] = useState({
    name: "",
    category: "Food Ingredient",
    unit: "pcs",
    currentStock: "",
    reorderLevel: "",
    expirationInput: "",
    expiresOn: "",
  });

  const [alaCarteForm, setAlaCarteForm] = useState({
    name: "",
    mainCategoryId: firstMainCategoryId,
    subCategoryId: firstSubCategoryId,
    price: "",
    variants: [],
    imageUrl: "",
    imageFileName: "",
    ingredientRequirements: [
      { ingredientId: firstIngredientId, quantity: "" },
    ],
  });

  const [comboForm, setComboForm] = useState({
    firstItemId: "",
    secondItemId: "",
    price: "",
    imageUrl: "",
    imageFileName: "",
  });

  const alaCarteOptions = menuItems.filter(
    (item) => item.type === "Ala Carte"
  );
  const selectedMainCategory = mainCategories.find(
    (category) => String(category.id) === String(alaCarteForm.mainCategoryId)
  );
  const isDrinkCategory = selectedMainCategory?.name?.toLowerCase().includes("drink") || false;

  function updateAlaCarteVariant(index, field, value) {
    setAlaCarteVariantError("");
    setAlaCarteForm((currentForm) => ({
      ...currentForm,
      variants: currentForm.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, [field]: value } : variant
      ),
    }));
  }

  function addAlaCarteVariant() {
    setAlaCarteVariantError("");
    setAlaCarteForm((currentForm) => ({
      ...currentForm,
      variants: [...currentForm.variants, { name: "", price: "" }],
    }));
  }

  function removeAlaCarteVariant(index) {
    setAlaCarteVariantError("");
    setAlaCarteForm((currentForm) => ({
      ...currentForm,
      variants: currentForm.variants.filter((_, variantIndex) => variantIndex !== index),
    }));
  }

  function updateAlaCarteRequirement(index, field, value) {
    setAlaCarteForm((currentForm) => ({
      ...currentForm,
      ingredientRequirements: currentForm.ingredientRequirements.map(
        (requirement, requirementIndex) =>
          requirementIndex === index
            ? { ...requirement, [field]: value }
            : requirement
      ),
    }));
  }

  function addAlaCarteRequirement() {
    setAlaCarteForm((currentForm) => ({
      ...currentForm,
      ingredientRequirements: [
        ...currentForm.ingredientRequirements,
        { ingredientId: firstIngredientId, quantity: "" },
      ],
    }));
  }

  function removeAlaCarteRequirement(index) {
    setAlaCarteForm((currentForm) => ({
      ...currentForm,
      ingredientRequirements: currentForm.ingredientRequirements.filter(
        (_, requirementIndex) => requirementIndex !== index
      ),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      if (addType === ADD_TYPES.SUBCATEGORY) {
        if (!subcategoryForm.name.trim()) return;

        await onAddSubCategory(subcategoryForm);
        onClose();
        return;
      }

      if (addType === ADD_TYPES.INGREDIENT) {
        const hasInvalidExpiration =
          ingredientForm.expirationInput.trim() !== "" &&
          ingredientForm.expiresOn === "";

        const isIncomplete =
          !ingredientForm.name.trim() ||
          !ingredientForm.unit.trim() ||
          ingredientForm.currentStock === "" ||
          ingredientForm.reorderLevel === "" ||
          hasInvalidExpiration;

        if (isIncomplete) return;

        await onAddIngredient(ingredientForm);
        onClose();
        return;
      }

      if (addType === ADD_TYPES.ALA_CARTE) {
        if (!alaCarteForm.name.trim()) return;

        if (!isDrinkCategory && alaCarteForm.price === "") return;
        if (isDrinkCategory) {
          if (alaCarteForm.variants.length === 0) {
            setAlaCarteVariantError("Add at least one size and price for this drink.");
            return;
          }
          if (alaCarteForm.variants.some((variant) =>
            !variant.name.trim() ||
            String(variant.price).trim() === "" ||
            !Number.isFinite(Number(variant.price)) ||
            Number(variant.price) < 0
          )) {
            setAlaCarteVariantError("Enter a size and valid price for every drink variant.");
            return;
          }

          const variantKeys = alaCarteForm.variants.map((variant) =>
            variant.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "")
          );
          if (new Set(variantKeys).size !== variantKeys.length) {
            setAlaCarteVariantError("Each drink size must have a unique name.");
            return;
          }
        }

        const validRequirements = alaCarteForm.ingredientRequirements.filter(
          (requirement) =>
            String(requirement.ingredientId ?? "").trim() !== "" &&
            String(requirement.quantity ?? "").trim() !== "" &&
            Number.isFinite(Number(requirement.ingredientId)) &&
            Number.isFinite(Number(requirement.quantity))
        );

        if (validRequirements.length === 0) return;

        await onAddAlaCarte({
          ...alaCarteForm,
          ingredientRequirements: validRequirements,
        });

        onClose();
        return;
      }

      const isComboIncomplete =
        comboForm.firstItemId === "" ||
        comboForm.secondItemId === "" ||
        comboForm.price === "";

      if (isComboIncomplete) return;

      await onAddCombo(comboForm);
      onClose();
    } catch (error) {
      console.error("Unable to save inventory item:", error.message);
    }
  }

  return (
    <div className="inventory-modal-backdrop">
      <section className="inventory-modal">
        <div className="inventory-modal-header">
          <div>
            <p className="admin-eyebrow">Inventory Setup</p>
            <h2>Add Item</h2>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="inventory-modal-form" onSubmit={handleSubmit}>
          <label>
            What do you want to add?
            <select
              value={addType}
              onChange={(event) => setAddType(event.target.value)}
            >
              {Object.values(ADD_TYPES).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          {addType === ADD_TYPES.SUBCATEGORY && (
            <AddSubcategoryFields
              formData={subcategoryForm}
              mainCategories={mainCategories}
              onChange={setSubcategoryForm}
            />
          )}

          {addType === ADD_TYPES.INGREDIENT && (
            <AddIngredientFields
              formData={ingredientForm}
              onChange={setIngredientForm}
            />
          )}

          {addType === ADD_TYPES.ALA_CARTE && (
            <AddAlaCarteFields
              formData={alaCarteForm}
            isDrinkCategory={isDrinkCategory}
            variantError={alaCarteVariantError}
              ingredients={ingredients}
              mainCategories={mainCategories}
              subCategories={subCategories}
              onChange={setAlaCarteForm}
              onRequirementChange={updateAlaCarteRequirement}
              onAddRequirement={addAlaCarteRequirement}
              onRemoveRequirement={removeAlaCarteRequirement}
            onVariantChange={updateAlaCarteVariant}
            onAddVariant={addAlaCarteVariant}
            onRemoveVariant={removeAlaCarteVariant}
            />
          )}

          {addType === ADD_TYPES.COMBO && (
            <AddComboFields
              formData={comboForm}
              alaCarteOptions={alaCarteOptions}
              onChange={setComboForm}
            />
          )}

          <div className="inventory-modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>

            <button type="submit" className="primary-button">
              Save
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default AddInventoryItemModal;
