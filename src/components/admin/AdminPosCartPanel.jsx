import AdminPosCartItem from "./AdminPosCartItem";

import { getCartTotal } from "../../utils/cartUtils";

function AdminPosCartPanel({
  cartItems,
  posForm,
  errors = {},
  onFormChange,
  onIncreaseQuantity,
  onDecreaseQuantity,
  onRemoveItem,
  onClearCart,
  onCreateOrder,
  isCreatingOrder = false,
}) {
  const cartTotal = getCartTotal(cartItems);
  const hasItems = cartItems.length > 0;
  const needsGcashReference = posForm.paymentMethod === "GCash";
  const hasGcashReference = posForm.paymentReferenceNumber.trim() !== "";
  const canCreateOrder =
    hasItems &&
    (!needsGcashReference || hasGcashReference) &&
    !errors.paymentReferenceNumber;

  return (
    <aside className="admin-pos-cart-panel">
      <div className="admin-pos-cart-header">
        <div>
          <h2>Current Order</h2>
          <p>Manual POS order</p>
        </div>

        {hasItems && (
          <button
            type="button"
            onClick={onClearCart}
            disabled={isCreatingOrder}
          >
            Clear
          </button>
        )}
      </div>

      <div className="admin-pos-form">
        <label>
          Customer Name
          <input
            type="text"
            name="customerName"
            value={posForm.customerName}
            onChange={onFormChange}
            placeholder="Walk-in Customer"
            maxLength={80}
            disabled={isCreatingOrder}
          />
          {errors.customerName && (
            <small className="form-error-message" role="alert">{errors.customerName}</small>
          )}
        </label>

        <label>
          Order Type
          <select
            name="orderType"
            value={posForm.orderType}
            onChange={onFormChange}
            disabled={isCreatingOrder}
          >
            <option value="Dine In">Dine In</option>
            <option value="Take Out">Take Out</option>
          </select>
        </label>

        <label>
          Payment Method
          <select
            name="paymentMethod"
            value={posForm.paymentMethod}
            onChange={onFormChange}
            disabled={isCreatingOrder}
          >
            <option value="Cash">Cash</option>
            <option value="GCash">GCash</option>
          </select>
        </label>

        {needsGcashReference && (
          <label>
            GCash Reference Number
            <input
              type="text"
              name="paymentReferenceNumber"
              value={posForm.paymentReferenceNumber}
              onChange={onFormChange}
              placeholder="Enter GCash transaction reference number"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={32}
              autoComplete="off"
              disabled={isCreatingOrder}
            />
            <small className="admin-pos-field-hint">
              
            </small>
            {errors.paymentReferenceNumber && (
              <small className="form-error-message" role="alert">
                {errors.paymentReferenceNumber}
              </small>
            )}
          </label>
        )}

        <label>
          Notes
          <textarea
            name="notes"
            value={posForm.notes}
            onChange={onFormChange}
            placeholder="Optional notes"
            maxLength={500}
            rows="3"
            disabled={isCreatingOrder}
          />
          {errors.notes && (
            <small className="form-error-message" role="alert">{errors.notes}</small>
          )}
        </label>
      </div>

      {errors.cart && <p className="form-error-message" role="alert">{errors.cart}</p>}

      <div className="admin-pos-cart-items">
        {hasItems ? (
          cartItems.map((item) => (
            <AdminPosCartItem
              key={item.cartId}
              item={item}
              onIncreaseQuantity={onIncreaseQuantity}
              onDecreaseQuantity={onDecreaseQuantity}
              onRemoveItem={onRemoveItem}
              disabled={isCreatingOrder}
            />
          ))
        ) : (
          <div className="admin-pos-empty-cart">
            <h3>No items yet</h3>
            <p>Add menu items to create a manual order.</p>
          </div>
        )}
      </div>

      <div className="admin-pos-total-row">
        <span>Total</span>
        <strong>₱{cartTotal.toFixed(2)}</strong>
      </div>

      <button
        type="button"
        className="primary-button admin-pos-submit-button"
        onClick={onCreateOrder}
        disabled={!canCreateOrder || isCreatingOrder}
      >
        {isCreatingOrder ? "Creating Order..." : "Create Manual Order"}
      </button>
    </aside>
  );
}

export default AdminPosCartPanel;
