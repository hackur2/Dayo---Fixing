function SubCategoryTabs({
  subCategoryList = [],
  activeSubCategory,
  onSubCategoryChange,
}) {
  if (subCategoryList.length === 0) {
    return null;
  }

  return (
    <section className="subcategory-tabs" aria-label="Menu subcategories">
      <button
        type="button"
        className={
          activeSubCategory === ""
            ? "subcategory-pill active"
            : "subcategory-pill"
        }
        onClick={() => onSubCategoryChange("")}
      >
        All
      </button>

      {subCategoryList.map((subCategory) => (
        <button
          key={subCategory}
          type="button"
          className={
            subCategory === activeSubCategory
              ? "subcategory-pill active"
              : "subcategory-pill"
          }
          onClick={() => onSubCategoryChange(subCategory)}
        >
          {subCategory}
        </button>
      ))}
    </section>
  );
}

export default SubCategoryTabs;