import { Link } from "react-router";

import { CUSTOMER_ROUTES } from "../../constants/routes";

import { useCurrentOrderData } from "../../hooks/useCurrentOrderData";
import { formatDateTime } from "../../utils/formatDateTime";

import "../../styles/customerIdNumber.css";

function CustomerIdNumberPage({ currentOrder, onStartNewOrder }) {
  const { orderData, orderError } = useCurrentOrderData(currentOrder);

  if (!orderData) {
    return (
      <main className="order-id-page">
        <section className="order-id-card empty-order-id-card">
          <h1>No ID Number available</h1>
          <p>Please place an order first to receive your ID Number.</p>

          <Link to={CUSTOMER_ROUTES.MENU} className="order-id-main-button">
            Back to Menu
          </Link>
        </section>
      </main>
    );
  }

  function handleStartNewOrder() {
    onStartNewOrder();
  }

  return (
    <main className="order-id-page">
      <section className="order-id-card">
        <div className="order-id-header">
          <p>ID Number</p>
          <h1>{orderData.orderNumber}</h1>
          <span>Show this ID Number to the order taker when asked. This page is an order reference, not proof of payment.</span>
        </div>

        {orderError && <p className="form-error-message">{orderError}</p>}

        <section className="order-id-info-grid">
          <div>
            <span>Customer</span>
            <strong>{orderData.customerName}</strong>
          </div>

          <div>
            <span>Order Type</span>
            <strong>{orderData.orderType}</strong>
          </div>

          <div>
            <span>Status</span>
            <strong>{orderData.status}</strong>
          </div>

          <div>
            <span>Date/Time</span>
            <strong>{formatDateTime(orderData.createdAt)}</strong>
          </div>
        </section>

        {orderData.notes && (
          <section className="order-id-notes">
            <span>Notes</span>
            <p>{orderData.notes}</p>
          </section>
        )}

        <section className="order-id-items-section">
          <h2>Order Items</h2>

          <div className="order-id-items-list">
            {orderData.items.map((item) => (
              <article
                key={`${item.menuItemId}-${item.selectedVariantId || "regular"}`}
                className="order-id-item-row"
              >
                <div>
                  <h3>
                    {item.quantity}× {item.name}
                  </h3>

                  {item.variantLabel && <p>{item.variantLabel}</p>}

                  <span>₱{item.price.toFixed(2)} each</span>
                </div>

                <strong>₱{item.subtotal.toFixed(2)}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="order-id-total-card">
          <span>VAT</span>
          <strong>₱0.00</strong>
        </section>
        <section className="order-id-total-card">
          <span>Total Amount</span>
          <strong>₱{orderData.totalAmount.toFixed(2)}</strong>
        </section>

        <div className="order-id-actions">
          <Link
            to={CUSTOMER_ROUTES.ORDER_STATUS}
            className="order-id-secondary-button"
          >
            View Order Status
          </Link>

          <Link
            to={CUSTOMER_ROUTES.FEEDBACK}
            className="order-id-secondary-button"
          >
            Give Feedback
          </Link>

          <button
            type="button"
            className="order-id-main-button"
            onClick={handleStartNewOrder}
          >
            Start New Order
          </button>
        </div>
      </section>
    </main>
  );
}

export default CustomerIdNumberPage;
