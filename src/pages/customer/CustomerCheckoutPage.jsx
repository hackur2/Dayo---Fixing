import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { CUSTOMER_ROUTES } from "../../constants/routes";

import { getCartTotal } from "../../utils/cartUtils";
import { getCheckoutValidation } from "../../utils/validationUtils";

import "../../styles/customerCheckout.css";

const DEFAULT_CHECKOUT_FORM = {
  customerName: "",
  orderType: "Dine In",
  paymentMethod: "Cash",
  paymentReferenceNumber: "",
  notes: "",
};

function CustomerCheckoutPage({
  cartItems,
  onPlaceOrder,
  isSubmittingOrder = false,
  submitOrderError = "",
}) {
  const navigate = useNavigate();

  const [checkoutForm, setCheckoutForm] = useState(DEFAULT_CHECKOUT_FORM);
  const [errors, setErrors] = useState({});

  const cartTotal = getCartTotal(cartItems);
  const hasItems = cartItems.length > 0;

  function handleInputChange(event) {
    const { name, value } = event.target;

    setCheckoutForm((currentForm) => ({
      ...currentForm,
      [name]: value,
      ...(name === "paymentMethod" && value !== "GCash"
        ? { paymentReferenceNumber: "" }
        : {}),
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      [name]: "",
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validation = getCheckoutValidation(checkoutForm, cartItems);

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      await onPlaceOrder(checkoutForm);
      navigate(CUSTOMER_ROUTES.ORDER_STATUS);
    } catch (error) {
      console.error("Checkout failed:", error.message);
    }
  }

  if (!hasItems) {
    return (
      <main className="customer-page">
        <section className="customer-card empty-checkout-card">
          <h1>Your bag is empty</h1>
          <p>Please add items first before going to checkout.</p>

          <Link to={CUSTOMER_ROUTES.MENU} className="checkout-main-button">
            Back to Menu
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="customer-page">
      <section className="customer-card">
        <div className="customer-page-header">
          <p>Customer Checkout</p>
          <h1>Review Your Order</h1>
          <span>Fill in your details before placing your order.</span>
        </div>

        {submitOrderError && (
          <p className="form-error-message">{submitOrderError}</p>
        )}

        {errors.cart && <p className="form-error-message">{errors.cart}</p>}

        <form className="checkout-form" onSubmit={handleSubmit}>
          <div className="checkout-form-group">
            <label htmlFor="customerName">Customer Name</label>
            <input
              type="text"
              id="customerName"
              name="customerName"
              value={checkoutForm.customerName}
              onChange={handleInputChange}
              placeholder="Enter your name"
              maxLength={80}
              disabled={isSubmittingOrder}
            />

            {errors.customerName && (
              <p className="form-error-message">{errors.customerName}</p>
            )}
          </div>

          <div className="checkout-form-group">
            <label htmlFor="orderType">Order Type</label>
            <select
              id="orderType"
              name="orderType"
              value={checkoutForm.orderType}
              onChange={handleInputChange}
              disabled={isSubmittingOrder}
            >
              <option value="Dine In">Dine In</option>
              <option value="Take Out">Take Out</option>
            </select>

            {errors.orderType && (
              <p className="form-error-message">{errors.orderType}</p>
            )}
          </div>

          <div className="checkout-form-group">
            <label htmlFor="paymentMethod">Payment Method</label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              value={checkoutForm.paymentMethod}
              onChange={handleInputChange}
              disabled={isSubmittingOrder}
            >
              <option value="Cash">Cash</option>
              <option value="GCash">GCash</option>
            </select>
          </div>

          {checkoutForm.paymentMethod === "GCash" && (
            <div className="checkout-form-group">
              <label htmlFor="paymentReferenceNumber">GCash Reference Number</label>
              <input
                type="text"
                id="paymentReferenceNumber"
                name="paymentReferenceNumber"
                inputMode="numeric"
                value={checkoutForm.paymentReferenceNumber}
                onChange={(event) => {
                  const value = event.target.value.replace(/[^0-9]/g, "").slice(0, 32);
                  setCheckoutForm((form) => ({ ...form, paymentReferenceNumber: value }));
                  setErrors((current) => ({ ...current, paymentReferenceNumber: "" }));
                }}
                placeholder="Enter your GCash reference number"
                maxLength={32}
                disabled={isSubmittingOrder}
              />
              {errors.paymentReferenceNumber && (
                <p className="form-error-message" role="alert">{errors.paymentReferenceNumber}</p>
              )}
            </div>
          )}

          <div className="checkout-form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={checkoutForm.notes}
              onChange={handleInputChange}
              placeholder="Example: No chili sauce please."
              maxLength={500}
              rows="4"
              disabled={isSubmittingOrder}
            />
            {errors.notes && (
              <p className="form-error-message" role="alert">{errors.notes}</p>
            )}
          </div>

          <section className="checkout-review-card">
            <div className="checkout-section-heading">
              <h2>Order Items</h2>
              <p>
                {cartItems.length} item{cartItems.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="checkout-items-list">
              {cartItems.map((item) => (
                <article key={item.cartId} className="checkout-item-row">
                  <div>
                    <h3>{item.name}</h3>
                    {item.recommendationSource && <span className="ai-origin-label">From {item.recommendationSource}</span>}

                    {item.variantLabel && <p>{item.variantLabel}</p>}

                    <span>
                      ₱{item.price.toFixed(2)} × {item.quantity}
                    </span>
                  </div>

                  <strong>₱{(item.price * item.quantity).toFixed(2)}</strong>
                </article>
              ))}
            </div>

            <div className="checkout-total-row">
              <span>VAT</span>
              <strong>₱0.00</strong>
            </div>
            <div className="checkout-total-row">
              <span>Total Amount</span>
              <strong>₱{cartTotal.toFixed(2)}</strong>
            </div>
          </section>

          <div className="checkout-actions">
            <Link to={CUSTOMER_ROUTES.BAG} className="checkout-secondary-button">
              Back to Bag
            </Link>

            <button
              type="submit"
              className="checkout-main-button"
              disabled={isSubmittingOrder}
            >
              {isSubmittingOrder ? "Submitting Order..." : "Place Order"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default CustomerCheckoutPage;
