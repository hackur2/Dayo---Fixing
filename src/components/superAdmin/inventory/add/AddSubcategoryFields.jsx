function AddSubcategoryFields({
  formData,
  mainCategories,
  onChange,
}) {
  return (
    <>
      <label>
        Main Category
        <select
          value={formData.mainCategoryId}
          onChange={(event) =>
            onChange({
              ...formData,
              mainCategoryId: event.target.value,
            })
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
        Subcategory Name
        <input
          type="text"
          value={formData.name}
          onChange={(event) =>
            onChange({
              ...formData,
              name: event.target.value,
            })
          }
          placeholder="Example: Starters"
        />
      </label>
    </>
  );
}

export default AddSubcategoryFields;
