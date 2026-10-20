import { Link } from "react-router";

import { CUSTOMER_ROUTES } from "../../constants/routes";

import { useCurrentOrderData } from "../../hooks/useCurrentOrderData";
import { formatDateTime } from "../../utils/formatDateTime";

import "../../styles/customerReceipt.css";

function CustomerReceiptPage({ currentOrder, onStartNewOrder }) {
  const { orderData, orderError } = useCurrentOrderData(currentOrder);

  if (!orderData) {
    return (
      <main className="receipt-page">
        <section className="receipt-card empty-receipt-card">
          <h1>No receipt found</h1>
          <p>Please place an order first to generate a receipt.</p>

          <Link to={CUSTOMER_ROUTES.MENU} className="receipt-main-button">
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
    <main className="receipt-page">
      <section className="receipt-card">
        <div className="receipt-header">
          <p>Digital Receipt</p>
          <h1>{orderData.orderNumber}</h1>
          <span>Please show this receipt to the order taker if needed.</span>
        </div>

        {orderError && <p className="form-error-message">{orderError}</p>}

        <section className="receipt-info-grid">
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
          <section className="receipt-notes">
            <span>Notes</span>
            <p>{orderData.notes}</p>
          </section>
        )}

        <section className="receipt-items-section">
          <h2>Order Items</h2>

          <div className="receipt-items-list">
            {orderData.items.map((item) => (
              <article
                key={`${item.menuItemId}-${item.selectedVariantId || "regular"}`}
                className="receipt-item-row"
              >
                <div>
                  <h3>
                    {item.quantity}× {item.name}
                  </h3>
                  {item.recommendationSource && <span className="ai-origin-label">From {item.recommendationSource}</span>}

                  {item.variantLabel && <p>{item.variantLabel}</p>}

                  <span>₱{item.price.toFixed(2)} each</span>
                </div>

                <strong>₱{item.subtotal.toFixed(2)}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="receipt-total-card">
          <span>VAT</span>
          <strong>₱0.00</strong>
        </section>
        <section className="receipt-total-card">
          <span>Total Amount</span>
          <strong>₱{orderData.totalAmount.toFixed(2)}</strong>
        </section>

        <div className="receipt-actions">
          <Link
            to={CUSTOMER_ROUTES.ORDER_STATUS}
            className="receipt-secondary-button"
          >
            View Order Status
          </Link>

          <Link
            to={CUSTOMER_ROUTES.FEEDBACK}
            className="receipt-secondary-button"
          >
            Give Feedback
          </Link>

          <button
            type="button"
            className="receipt-main-button"
            onClick={handleStartNewOrder}
          >
            Start New Order
          </button>
        </div>
      </section>
    </main>
  );
}

export default CustomerReceiptPage;
