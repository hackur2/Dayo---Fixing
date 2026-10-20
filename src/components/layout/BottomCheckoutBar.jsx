import { Link } from "react-router";

import { CUSTOMER_ROUTES } from "../../constants/routes";

function BottomCheckoutBar({ cartItemCount, cartTotal }) {
  // With an empty cart, there is no useful action for this floating bar.
  if (cartItemCount <= 0) {
    return null;
  }

  const itemLabel = `${cartItemCount} item${cartItemCount === 1 ? "" : "s"}`;
  const formattedTotal = Number(cartTotal || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <section className="bottom-checkout-bar" aria-label="Cart summary">
      <Link
        to={CUSTOMER_ROUTES.BAG}
        className="checkout-bag-icon"
        aria-label="Open shopping bag"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8h14l1 12H4L5 8Z" />
          <path d="M9 9V6a3 3 0 0 1 6 0v3" />
        </svg>
      </Link>

      <div className="checkout-cart-details" aria-live="polite" aria-atomic="true">
        <span className="checkout-item-count">{itemLabel}</span>
        <strong className="checkout-total-price">₱{formattedTotal}</strong>
      </div>

      <Link to={CUSTOMER_ROUTES.CHECKOUT} className="checkout-action">
        <span>Checkout</span>
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </Link>
    </section>
  );
}

export default BottomCheckoutBar;
