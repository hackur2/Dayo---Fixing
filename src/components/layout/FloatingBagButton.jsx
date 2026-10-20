import { Link } from "react-router";

import { CUSTOMER_ROUTES } from "../../constants/routes";

function FloatingBagButton({ cartItemCount }) {
  return (
    <Link
      to={CUSTOMER_ROUTES.BAG}
      className="floating-bag-button"
      aria-label={`Open shopping bag${cartItemCount > 0 ? `, ${cartItemCount} items` : ""}`}
    >
      <span className="floating-bag-icon" aria-hidden="true">🛍️</span>

      {cartItemCount > 0 && (
        <span className="floating-bag-count">{cartItemCount}</span>
      )}
    </Link>
  );
}

export default FloatingBagButton;
