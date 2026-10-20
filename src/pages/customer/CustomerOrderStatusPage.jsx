import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { CUSTOMER_ROUTES } from "../../constants/routes";
import { useCurrentOrderData } from "../../hooks/useCurrentOrderData";
import { formatDateTime } from "../../utils/formatDateTime";

import "../../styles/customerOrderStatus.css";

const STATUS_STEPS = ["Pending", "Preparing", "Ready", "Completed"];

function CustomerOrderStatusPage({
  currentOrder,
  orderHistory = [],
  onSelectOrder,
  onOrderUpdated,
  onCancelOrder,
  onStartNewOrder,
}) {
  const navigate = useNavigate();
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const { orderData, isLoadingOrder, orderError, refreshOrderStatus } =
    useCurrentOrderData(currentOrder, onOrderUpdated);

  function handleStartNewOrder() {
    onStartNewOrder();
    navigate(CUSTOMER_ROUTES.MENU);
  }

  async function handleCustomerCancel() {
    if (!orderData?.orderNumber || orderData.status !== "Pending" || isCancelling) return;
    if (!window.confirm("Cancel this order? This cannot be undone.")) return;

    try {
      setIsCancelling(true);
      setCancelError("");
      await onCancelOrder(orderData.orderNumber);
      await refreshOrderStatus();
    } catch (error) {
      console.error("Unable to cancel customer order:", error.message);
      setCancelError(error.message || "Unable to cancel this order. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  if (!orderData) {
    return (
      <main className="order-status-page">
        <section className="order-status-card empty-order-status-card">
          <h1>No saved order</h1>
          <p>Place an order to see its ID Number and preparation status here.</p>
          <Link to={CUSTOMER_ROUTES.MENU} className="order-status-main-button">
            Back to Menu
          </Link>
        </section>
      </main>
    );
  }

  const currentStatusIndex = STATUS_STEPS.indexOf(orderData.status);
  const canGiveFeedback = String(orderData.status).trim().toLowerCase() === "completed";
  const otherOrders = orderHistory.filter(
    (order) => order?.orderNumber && order.orderNumber !== orderData.orderNumber
  );

  return (
    <main className="order-status-page">
      <section className="order-status-card">
        <div className="order-status-header">
          <p>Order Status · ID Number</p>
          <h1>{orderData.orderNumber}</h1>
          <span>Track the preparation status of your order.</span>
        </div>

        {orderError && <p className="form-error-message" role="alert">{orderError}</p>}

        <section className="order-status-current-card" aria-label="Current order status">
          <button
            type="button"
            className="order-status-refresh-button"
            onClick={refreshOrderStatus}
            disabled={isLoadingOrder}
            aria-label={isLoadingOrder ? "Refreshing order status" : "Refresh order status"}
            title="Refresh status"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={isLoadingOrder ? "is-refreshing" : ""}
            >
              <path d="M20 11a8 8 0 0 0-14-5L4 8" />
              <path d="M4 4v4h4" />
              <path d="M4 13a8 8 0 0 0 14 5l2-2" />
              <path d="M16 16h4v4" />
            </svg>
          </button>
          <span>Current Status</span>
          <strong aria-live="polite">{orderData.status}</strong>
          <p>{orderData.customerName}</p>
        </section>

        <section className="order-status-steps">
          {STATUS_STEPS.map((status, index) => (
            <div
              key={status}
              className={index <= currentStatusIndex ? "order-status-step active" : "order-status-step"}
            >
              <span>{index + 1}</span>
              <p>{status}</p>
            </div>
          ))}
        </section>

        <section className="order-status-details">
          <div>
            <span>Order Type</span>
            <strong>{orderData.orderType}</strong>
          </div>
          <div>
            <span>VAT</span>
            <strong>₱0.00</strong>
          </div>
          <div>
            <span>Total Amount</span>
            <strong>₱{orderData.totalAmount.toFixed(2)}</strong>
          </div>
          <div>
            <span>Created At</span>
            <strong>{formatDateTime(orderData.createdAt)}</strong>
          </div>
          <div>
            <span>Notes</span>
            <strong>{orderData.notes?.trim() || "No notes provided"}</strong>
          </div>
        </section>

        <section className="order-status-items">
          <h2>Order Items</h2>
          <div className="order-status-items-list">
            {orderData.items.map((item, index) => (
              <article
                key={`${item.menuItemId}-${item.selectedVariantId || "regular"}-${index}`}
                className="order-status-item-row"
              >
                <div>
                  <h3>{item.quantity}× {item.name}</h3>
                  {item.recommendationSource && <span className="ai-origin-label">From {item.recommendationSource}</span>}
                  {item.variantLabel && <p>{item.variantLabel}</p>}
                </div>
                <strong>₱{item.subtotal.toFixed(2)}</strong>
              </article>
            ))}
          </div>
        </section>

        <div className="order-status-actions">
          {orderData.status === "Pending" && (
            <button
              type="button"
              className="order-status-cancel-button"
              onClick={handleCustomerCancel}
              disabled={isCancelling || isLoadingOrder}
            >
              {isCancelling ? "Cancelling..." : "Cancel Order"}
            </button>
          )}
          {canGiveFeedback && (
            <Link to={CUSTOMER_ROUTES.FEEDBACK} className="order-status-main-button">
              Give Feedback
            </Link>
          )}
          <button
            type="button"
            className="order-status-secondary-button"
            onClick={handleStartNewOrder}
          >
            Start New Order
          </button>
        </div>

        {cancelError && <p className="form-error-message" role="alert">{cancelError}</p>}

        {otherOrders.length > 0 && (
          <section className="order-status-history">
            <h2>Other Saved Orders</h2>
            <p></p>
            <div className="order-status-history-list">
              {otherOrders.map((order) => (
                <button
                  type="button"
                  className="order-status-history-item"
                  key={order.orderNumber}
                  onClick={() => onSelectOrder(order.orderNumber)}
                >
                  <span>{order.orderNumber}</span>
                  <span>{order.status}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

export default CustomerOrderStatusPage;
