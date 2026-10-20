function AdminPosCartItem({
  item,
  onIncreaseQuantity,
  onDecreaseQuantity,
  onRemoveItem,
  disabled = false,
}) {
  const itemTotal = item.price * item.quantity;

  return (
    <article className="admin-pos-cart-item">
      <div>
        <h3>{item.name}</h3>

        {item.variantLabel && <p>{item.variantLabel}</p>}

        <span>₱{item.price.toFixed(2)}</span>
      </div>

      <div className="admin-pos-quantity-controls">
        <button
          type="button"
          onClick={() => onDecreaseQuantity(item.cartId)}
          disabled={disabled}
          aria-label={`Decrease quantity of ${item.name}`}
        >
          -
        </button>

        <strong>{item.quantity}</strong>

        <button
          type="button"
          onClick={() => onIncreaseQuantity(item)}
          disabled={disabled}
          aria-label={`Increase quantity of ${item.name}`}
        >
          +
        </button>
      </div>

      <strong>₱{itemTotal.toFixed(2)}</strong>

      <button
        type="button"
        className="admin-pos-remove-button"
        onClick={() => onRemoveItem(item.cartId)}
        disabled={disabled}
      >
        Remove
      </button>
    </article>
  );
}

export default AdminPosCartItem;
