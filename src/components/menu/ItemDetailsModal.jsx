import { useEffect, useState } from "react";

import MenuItemImage from "../common/MenuItemImage";

import { getItemQuantity } from "../../utils/cartUtils";

function ItemDetailsModal({ item, cartItems, onClose, onAddToCart }) {
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!item) {
      return;
    }

    setSelectedVariantId(item.variants?.[0]?.id || null);
    setQuantity(1);
  }, [item]);

  useEffect(() => {
    if (!item) {
      return undefined;
    }

    function handleEscapeKey(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [item, onClose]);

  if (!item) {
    return null;
  }

  const hasVariants = item.variants?.length > 0;

  const selectedVariant = hasVariants
  ? item.variants.find((variant) => variant.id === selectedVariantId) ||
    item.variants[0]
  : null;

const variantId = selectedVariant?.id || null;
const unitPrice = selectedVariant?.price ?? item.price ?? 0;

  const quantityInCart = getItemQuantity(cartItems, item.id, variantId);
  const remainingStock = Math.max(item.available - quantityInCart, 0);

  const isUnavailable = item.available === 0;
  const isMaxReached = remainingStock === 0;

  const fallbackText = item.name.charAt(0).toUpperCase();

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleVariantChange(event) {
    setSelectedVariantId(event.target.value);
    setQuantity(1);
  }

  function handleDecreaseQuantity() {
    setQuantity((currentQuantity) => Math.max(1, currentQuantity - 1));
  }

  function handleIncreaseQuantity() {
    setQuantity((currentQuantity) =>
      Math.min(remainingStock, currentQuantity + 1)
    );
  }

  function handleAddToCart() {
    if (isUnavailable || isMaxReached) {
      return;
    }

    onAddToCart(item, selectedVariant, quantity);
    onClose();
  }

  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <section
        className="item-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-details-title"
      >
        <button
          type="button"
          className="modal-close-button"
          onClick={onClose}
          aria-label="Close item details"
        >
          ×
        </button>

        <MenuItemImage
          src={item.imageUrl}
          alt={item.name}
          fallbackText={fallbackText}
          className="modal-menu-image"
          loading="eager"
        />

        <div className="modal-item-heading">
          <span className="brand-tag">{item.brand}</span>
          <p className="item-category">{item.subCategory}</p>

          <h2 id="item-details-title">{item.name}</h2>
        </div>

        <p className="modal-item-description">{item.description}</p>

        {hasVariants && (
          <div className="variant-selector">
            <label htmlFor="itemVariant">Choose Size</label>

            <select
              id="itemVariant"
              value={selectedVariant?.id || ""}
              onChange={handleVariantChange}
            >
              {item.variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name} - ₱{variant.price.toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="modal-item-information">
          <div>
            <span>Price</span>
            <strong>₱{unitPrice.toFixed(2)}</strong>
          </div>

          <div>
            <span>Available</span>
            <strong>{remainingStock}</strong>
          </div>
        </div>

        <div className="modal-quantity-section">
          <span>Quantity</span>

          <div className="modal-quantity-controls">
            <button
              type="button"
              onClick={handleDecreaseQuantity}
              disabled={quantity === 1}
            >
              -
            </button>

            <strong>{quantity}</strong>

            <button
              type="button"
              onClick={handleIncreaseQuantity}
              disabled={quantity >= remainingStock}
            >
              +
            </button>
          </div>
        </div>

        {quantityInCart > 0 && (
          <p className="modal-bag-quantity">
            You already have {quantityInCart} of this item in your bag.
          </p>
        )}

        <button
          type="button"
          className="modal-add-button"
          onClick={handleAddToCart}
          disabled={isUnavailable || isMaxReached}
        >
          {isUnavailable
            ? "Currently Unavailable"
            : isMaxReached
              ? "Maximum Quantity Reached"
              : `Add to Bag • ₱${(unitPrice * quantity).toFixed(2)}`}
        </button>
      </section>
    </div>
  );
}

export default ItemDetailsModal;