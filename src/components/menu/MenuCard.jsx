import MenuItemImage from "../common/MenuItemImage";

import { getItemDisplayPrice } from "../../utils/cartUtils";

function MenuCard({
  item,
  onOpenDetails,
  onAddToCart,
  onDecreaseFromCart,
  cartIdInCart = null,
  quantityInCart = 0,
  imageLoading = "lazy",
}) {
  const hasVariants = item.variants?.length > 0;
  const isUnavailable = item.available === 0;
  const isMaxQuantityReached = quantityInCart >= item.available;
  const fallbackText = item.name.charAt(0).toUpperCase();

  function handleCardKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenDetails(item);
    }
  }

  function handleAddButtonClick(event) {
    event.stopPropagation();

    if (hasVariants) {
      onOpenDetails(item);
      return;
    }

    onAddToCart(item);
  }

  return (
    <article
      className="menu-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetails(item)}
      onKeyDown={handleCardKeyDown}
      aria-label={`View details for ${item.name}`}
    >
      <MenuItemImage
        src={item.imageUrl}
        alt={item.name}
        fallbackText={fallbackText}
        className="menu-card-image"
        loading={imageLoading}
      />

      <div className="menu-card-body">
        <h3>{item.name}</h3>

        <p className="menu-card-meta">
          {item.subCategory} · {item.brand}
        </p>

        <p className="card-price">{getItemDisplayPrice(item)}</p>
      </div>

      <div className={`menu-card-quantity${quantityInCart > 0 ? " is-in-cart" : ""}`}>
        {quantityInCart > 0 && (
          <button
            type="button"
            className="quantity-step-button"
            onClick={(event) => {
              event.stopPropagation();
              if (cartIdInCart) onDecreaseFromCart(cartIdInCart);
            }}
            aria-label={`Remove one ${item.name} from bag`}
          >
            <span aria-hidden="true">−</span>
          </button>
        )}
        {quantityInCart > 0 && (
          <span className="menu-card-quantity-count" aria-live="polite">{quantityInCart}</span>
        )}
        <button
          type="button"
          className="add-button"
          onClick={handleAddButtonClick}
          disabled={isUnavailable || isMaxQuantityReached}
          aria-label={quantityInCart > 0 ? `Add another ${item.name}` : `Add ${item.name} to bag`}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </article>
  );
}

export default MenuCard;
