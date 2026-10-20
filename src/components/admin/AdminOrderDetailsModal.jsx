function formatDateTime(value) {
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AdminOrderDetailsModal({ order, onClose }) {
  if (!order) {
    return null;
  }

  return (
    <div
      className="admin-order-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="admin-order-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-order-modal-title"
      >
        <div className="admin-order-modal-header">
          <div>
            <p className="admin-eyebrow">Order Summary</p>
            <h2 id="admin-order-modal-title">{order.orderNumber}</h2>
            <span>{formatDateTime(order.createdAt)}</span>
          </div>

          <button type="button" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <div className="admin-order-details-grid">
          <div>
            <span>Customer</span>
            <strong>{order.customerName}</strong>
          </div>

          <div>
            <span>Order Type</span>
            <strong>{order.orderType}</strong>
          </div>

          <div>
            <span>Status</span>
            <strong>{order.status}</strong>
          </div>

          <div>
            <span>Total Amount</span>
            <strong>₱{order.totalAmount.toFixed(2)}</strong>
          </div>
        </div>

        {order.notes && (
          <div className="admin-order-notes">
            <span>Notes</span>
            <p>{order.notes}</p>
          </div>
        )}

        <section className="admin-order-modal-items">
          <h3>Items</h3>

          <div className="admin-order-modal-list">
            {order.items.map((item) => (
              <article
                key={`${order.orderNumber}-${item.menuItemId}-${
                  item.selectedVariantId || "regular"
                }`}
                className="admin-order-modal-item"
              >
                <div>
                  <strong>
                    {item.quantity}× {item.name}
                  </strong>
                  {item.recommendationSource && <span className="ai-origin-label">From {item.recommendationSource}</span>}

                  {item.variantLabel && <p>{item.variantLabel}</p>}

                  <span>₱{item.price.toFixed(2)} each</span>
                </div>

                <strong>₱{item.subtotal.toFixed(2)}</strong>
              </article>
            ))}
          </div>
        </section>

        <div className="admin-order-modal-total">
          <span>VAT</span>
          <strong>₱0.00</strong>
        </div>
        <div className="admin-order-modal-total">
          <span>Total</span>
          <strong>₱{order.totalAmount.toFixed(2)}</strong>
        </div>
      </section>
    </div>
  );
}

export default AdminOrderDetailsModal;
