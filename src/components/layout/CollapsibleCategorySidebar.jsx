import { useState } from "react";

function CollapsibleCategorySidebar({
  isOpen,
  categories,
  subCategories,
  activeMainCategory,
  activeSubCategory,
  onSelectMainCategory,
  onSelectSubCategory,
  onClose,
}) {
  const [expandedCategory, setExpandedCategory] = useState(activeMainCategory);

  if (!isOpen) {
    return null;
  }

  function handleMainCategoryClick(category) {
    const hasSubCategories = Boolean(subCategories[category]);

    onSelectMainCategory(category);

    if (hasSubCategories) {
      setExpandedCategory((currentCategory) =>
        currentCategory === category ? "" : category
      );
      return;
    }

    onClose();
  }

  function handleSubCategoryClick(subCategory) {
    onSelectSubCategory(subCategory);
    onClose();
  }

  return (
    <div className="sidebar-backdrop" onClick={onClose} role="presentation">
      <aside
        className="collapsible-sidebar"
        onClick={(event) => event.stopPropagation()}
        aria-label="Menu categories"
      >
        <div className="sidebar-header">
          <div>
            <h2>Categories</h2>
            <p>Choose what you want to browse</p>
          </div>

          <button type="button" onClick={onClose} aria-label="Close categories">
            ×
          </button>
        </div>

        <div className="sidebar-category-list">
          {categories.map((category) => {
            const childCategories = subCategories[category] || [];
            const hasSubCategories = childCategories.length > 0;
            const isExpanded = expandedCategory === category;
            const isActive = activeMainCategory === category;

            return (
              <div key={category} className="sidebar-category-group">
                <button
                  type="button"
                  className={
                    isActive
                      ? "sidebar-category-button active"
                      : "sidebar-category-button"
                  }
                  onClick={() => handleMainCategoryClick(category)}
                >
                  <span>{category}</span>
                  {hasSubCategories && <strong>{isExpanded ? "−" : "+"}</strong>}
                </button>

                {hasSubCategories && isExpanded && (
                  <div className="sidebar-subcategory-list">
                    {childCategories.map((subCategory) => (
                      <button
                        key={subCategory}
                        type="button"
                        className={
                          activeSubCategory === subCategory
                            ? "sidebar-subcategory-button active"
                            : "sidebar-subcategory-button"
                        }
                        onClick={() => handleSubCategoryClick(subCategory)}
                      >
                        {subCategory}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

export default CollapsibleCategorySidebar;