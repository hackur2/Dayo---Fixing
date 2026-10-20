import { useEffect, useState } from "react";

const NEXT_STATUS = {
  Pending: "Preparing",
  Preparing: "Ready",
  Ready: "Completed",
};

function getOrderTime(createdAt) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function KdsOrderCard({ order, onUpdateStatus, onCancelOrder }) {
  const nextStatus = NEXT_STATUS[order.status];
  const [now, setNow] = useState(Date.now());
  const [customerPayment, setCustomerPayment] = useState("");
  const totalAmount = Number(order.totalAmount) || 0;
  const paidAmount = customerPayment === "" ? null : Number(customerPayment);
  const changeAmount = paidAmount === null ? null : paidAmount - totalAmount;

  useEffect(() => {
    if (order.status !== "Pending") return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [order.status]);

  const pendingTimeLeft = Math.max(
    0,
    5 * 60 - Math.floor((now - new Date(order.createdAt).getTime()) / 1000)
  );

  return (
    <article className="kds-order-card">
      <div className="kds-order-header">
        <div>
          <h2>{order.orderNumber}</h2>
          <p>{order.customerName}</p>
        </div>

        <span className={`kds-status-badge ${order.status.toLowerCase()}`}>
          {order.status}
        </span>
      </div>

      <div className="kds-order-meta">
        <span>{order.orderType}</span>
        <span>{getOrderTime(order.createdAt)}</span>
        <span>₱{order.totalAmount.toFixed(2)}</span>
      </div>

      {order.status === "Pending" && order.paymentMethod.toLowerCase() === "cash" && (
        <div className="kds-cash-payment">
          <label htmlFor={`customer-payment-${order.orderNumber}`}>Customer payment</label>
          <div className="kds-cash-payment-row">
            <span>₱</span>
            <input
              id={`customer-payment-${order.orderNumber}`}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={customerPayment}
              onChange={(event) => setCustomerPayment(event.target.value)}
              placeholder="Enter amount received"
              aria-describedby={`customer-change-${order.orderNumber}`}
            />
          </div>
          {changeAmount !== null && (
            <p
              id={`customer-change-${order.orderNumber}`}
              className={changeAmount < 0 ? "kds-cash-balance" : "kds-cash-change"}
              aria-live="polite"
            >
              {changeAmount < 0
                ? `Amount due: ₱${Math.abs(changeAmount).toFixed(2)}`
                : `Change: ₱${changeAmount.toFixed(2)}`}
            </p>
          )}
        </div>
      )}

      {order.status === "Pending" && (
        <p className="kds-order-countdown" role="timer">
          Auto-cancel in {Math.floor(pendingTimeLeft / 60)}:{String(pendingTimeLeft % 60).padStart(2, "0")}
        </p>
      )}

      <section className="kds-items-section">
        <h3>Items</h3>

        <div className="kds-items-list">
          {order.items.map((item) => (
            <div
              key={`${order.orderNumber}-${item.menuItemId}-${item.selectedVariantId || "regular"}`}
              className="kds-item-row"
            >
              <div>
                <strong>
                  {item.quantity}× {item.name}
                </strong>
                {item.recommendationSource && <span className="ai-origin-label">From {item.recommendationSource}</span>}

                {item.variantLabel && <p>{item.variantLabel}</p>}
              </div>

              <span>₱{item.subtotal.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </section>

      {order.notes && (
        <div className="kds-notes-box">
          <span>Customer Notes</span>
          <p>{order.notes}</p>
        </div>
      )}

      <div className="kds-order-actions">
        {nextStatus && (
          <button
            type="button"
            className="primary-button"
            onClick={() => onUpdateStatus(order.orderNumber, nextStatus)}
          >
            Mark as {nextStatus}
          </button>
        )}

        <button
          type="button"
          className="secondary-button"
          onClick={() => onCancelOrder(order.orderNumber)}
        >
          Cancel
        </button>
      </div>
    </article>
  );
}

export default KdsOrderCard;
