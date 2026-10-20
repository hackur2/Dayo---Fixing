import { Link } from "react-router";

import { CUSTOMER_ROUTES } from "../../constants/routes";

import {
  getCartItemCount,
  getCartTotal,
} from "../../utils/cartUtils";

import "../../styles/customerCart.css";

function CustomerCartPage({
  cartItems,
  onIncreaseQuantity,
  onDecreaseQuantity,
  onRemoveItem,
  onClearCart,
}) {
  const totalItems = getCartItemCount(cartItems);
  const totalAmount = getCartTotal(cartItems);
  const hasItems = cartItems.length > 0;

  return (
    <main className="bag-page">
      <Link to={CUSTOMER_ROUTES.MENU} className="bag-back-link">
        <span aria-hidden="true">←</span>
        <span>Back to Menu</span>
      </Link>

      <header className="bag-header">
        <h1>Your Bag</h1>
        <p> </p>
      </header>

      {hasItems ? (
        <section className="bag-items-list">
          {cartItems.map((item) => (
            <article key={item.cartId} className="bag-item-card">
              <div className="bag-item-main">
                <div>
                  <h2>{item.name}</h2>
                  {item.recommendationSource && <span className="ai-origin-label">From {item.recommendationSource}</span>}

                  {item.variantLabel && <p>{item.variantLabel}</p>}

                  <span>₱{item.price.toFixed(2)} each</span>
                </div>

                <strong>₱{(item.price * item.quantity).toFixed(2)}</strong>
              </div>

              <div className="bag-item-actions">
                <div className="bag-quantity-controls">
                  <button
                    type="button"
                    onClick={() => onDecreaseQuantity(item.cartId)}
                    aria-label={`Decrease ${item.name}`}
                  >
                    -
                  </button>

                  <span>{item.quantity}</span>

                  <button
                    type="button"
                    onClick={() =>
                      onIncreaseQuantity(
                        item,
                        item.selectedVariant || null,
                        1
                      )
                    }
                    aria-label={`Increase ${item.name}`}
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  className="bag-remove-button"
                  onClick={() => onRemoveItem(item.cartId)}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}

          <button
            type="button"
            className="bag-clear-button"
            onClick={onClearCart}
          >
            Clear Bag
          </button>
        </section>
      ) : (
        <section className="bag-empty-card">
          <h2>Your bag is empty</h2>
          <p>Add food or drinks from the menu first.</p>

          <Link to={CUSTOMER_ROUTES.MENU} className="bag-browse-button">
            Browse Menu
          </Link>
        </section>
      )}

      <section className="bag-bottom-summary">
        <div className="bag-summary-row">
          <span>Total Items</span>
          <strong>{totalItems}</strong>
        </div>

        <div className="bag-summary-row">
          <span>VAT</span>
          <strong>₱0.00</strong>
        </div>

        <div className="bag-summary-row">
          <span>Total Amount</span>
          <strong>₱{totalAmount.toFixed(2)}</strong>
        </div>

        <Link
          to={CUSTOMER_ROUTES.CHECKOUT}
          className={
            hasItems
              ? "bag-checkout-button"
              : "bag-checkout-button disabled"
          }
          aria-disabled={!hasItems}
          onClick={(event) => {
            if (!hasItems) {
              event.preventDefault();
            }
          }}
        >
          Proceed to Checkout
        </Link>
      </section>
    </main>
  );
}

export default CustomerCartPage;
