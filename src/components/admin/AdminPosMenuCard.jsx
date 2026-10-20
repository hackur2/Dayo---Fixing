import { useState } from "react";

import { getItemDisplayPrice } from "../../utils/cartUtils";

function AdminPosMenuCard({ item, onAddItem, disabled = false, available = true }) {
  const variants = item.variants || [];
  const hasVariants = variants.length > 0;

  const [selectedVariantId, setSelectedVariantId] = useState(
    variants[0]?.id || ""
  );

  const selectedVariant = hasVariants
    ? variants.find((variant) => variant.id === selectedVariantId) || variants[0]
    : null;

  function handleAddItem() {
    if (disabled || !available) {
      return;
    }

    onAddItem(item, selectedVariant);
  }

  return (
    <article className={`admin-pos-menu-card${available ? "" : " unavailable"}`}>
      <div className="admin-pos-menu-info">
        <h2>{item.name}</h2>

        <div className="admin-pos-menu-details">
          <span>{item.subCategory}</span>
          <span>{item.brand}</span>
        </div>

        <strong>{getItemDisplayPrice(item)}</strong>
        {!available && (
          <span className="admin-pos-unavailable-label">Not available</span>
        )}

        {hasVariants && (
          <select
            value={selectedVariantId}
            onChange={(event) => setSelectedVariantId(event.target.value)}
            className="admin-pos-variant-select"
            aria-label={`Choose a variant for ${item.name}`}
            disabled={disabled || !available}
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name} - ₱{variant.price.toFixed(2)}
              </option>
            ))}
          </select>
        )}
      </div>

      <button
        type="button"
        className="admin-pos-menu-add-button"
        onClick={handleAddItem}
        aria-label={available ? `Add ${item.name}` : `${item.name} is not available`}
        title={available ? `Add ${item.name}` : "Not available"}
        disabled={disabled || !available}
      >
        <span aria-hidden="true">+</span>
      </button>
    </article>
  );
}

export default AdminPosMenuCard;
