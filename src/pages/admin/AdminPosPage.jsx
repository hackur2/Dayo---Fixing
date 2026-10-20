import { useMemo, useState } from "react";

import AdminPosMenuCard from "../../components/admin/AdminPosMenuCard";
import AdminPosCartPanel from "../../components/admin/AdminPosCartPanel";

import { useMenuItems } from "../../hooks/useMenuItems";

import { useSubmitManualOrder } from "../../hooks/useSubmitManualOrder";

import {
  addItemToCart,
  decreaseItemQuantity,
  removeItemFromCart,
} from "../../utils/cartUtils";

import { getManualPosValidation } from "../../utils/validationUtils";

import "../../styles/adminPos.css";

const DEFAULT_POS_FORM = {
  customerName: "",
  orderType: "Dine In",
  paymentMethod: "Cash",
  paymentReferenceNumber: "",
  notes: "",
};

function matchesSearch(item, searchValue) {
  if (!searchValue) {
    return true;
  }

  return [item.name, item.brand, item.subCategory].some((value) =>
    String(value || "")
      .toLowerCase()
      .includes(searchValue)
  );
}

function AdminPosPage({ panelLabel = "Admin Panel" }) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [posForm, setPosForm] = useState(DEFAULT_POS_FORM);
  const [latestOrder, setLatestOrder] = useState(null);
  const [posErrors, setPosErrors] = useState({});
  const { menuItems, isLoading, errorMessage } = useMenuItems();
  const mainCategories = ["All", ...new Set(menuItems.map((item) => item.mainCategory).filter(Boolean))];

  const {
    submitManualOrder,
    isCreatingManualOrder,
    manualOrderError,
  } = useSubmitManualOrder();

  const filteredMenuItems = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    return menuItems.filter((item) => {
      const matchesCategory =
        activeCategory === "All" || item.mainCategory === activeCategory;
      const matchesAvailability = !showAvailableOnly ||
        (item.isAvailable && Number(item.available) > 0);

      return matchesCategory && matchesAvailability && matchesSearch(item, searchValue);
    });
  }, [activeCategory, searchTerm, showAvailableOnly, menuItems]);

  function handleFormChange(event) {
    const { name, value } = event.target;

    // Never silently change a pasted payment reference number.
    if (name === "paymentReferenceNumber" && /[^0-9]/.test(value)) {
      setPosErrors((errors) => ({
        ...errors,
        paymentReferenceNumber: "Digits only (0–9) are allowed.",
      }));
      return;
    }

    setPosErrors((errors) => ({
      ...errors,
      [name]: "",
      ...(name === "paymentMethod" ? { paymentReferenceNumber: "" } : {}),
    }));

    setPosForm((currentForm) => ({
      ...currentForm,
      [name]: value,
      ...(name === "paymentMethod" && value !== "GCash"
        ? { paymentReferenceNumber: "" }
        : {}),
    }));
  }

  function handleAddItem(item, selectedVariant = null) {
    setCartItems((currentCartItems) =>
      addItemToCart(currentCartItems, item, selectedVariant, 1)
    );
  }

  function handleIncreaseQuantity(cartItem) {
    setCartItems((currentCartItems) =>
      addItemToCart(
        currentCartItems,
        cartItem,
        cartItem.selectedVariant || null,
        1
      )
    );
  }

  function handleDecreaseQuantity(cartId) {
    setCartItems((currentCartItems) =>
      decreaseItemQuantity(currentCartItems, cartId)
    );
  }

  function handleRemoveItem(cartId) {
    setCartItems((currentCartItems) =>
      removeItemFromCart(currentCartItems, cartId)
    );
  }

  function handleClearCart() {
    setCartItems([]);
  }

  async function handleCreateOrder() {
    if (isCreatingManualOrder || posErrors.paymentReferenceNumber) return;

    const validation = getManualPosValidation(posForm, cartItems);
    if (!validation.isValid) {
      setPosErrors(validation.errors);
      return;
    }

    setPosErrors({});
    try {
      const newManualOrder = await submitManualOrder(posForm, cartItems);

      setLatestOrder(newManualOrder);
      setCartItems([]);
      setPosForm(DEFAULT_POS_FORM);
      setPosErrors({});
    } catch (error) {
      console.error("Manual POS order failed:", error.message);
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">{panelLabel}</p>
          <h1>POS</h1>
        </div>
      </div>

      {latestOrder && (
        <section className="admin-pos-success-card">
          <div>
            <span>Manual order created</span>
            <strong>{latestOrder.orderNumber}</strong>
            <p>
              {latestOrder.customerName} · ₱
              {latestOrder.totalAmount.toFixed(2)}
            </p>

            {latestOrder.paymentMethod === "GCash" &&
              latestOrder.paymentReferenceNumber && (
                <p>GCash Ref: {latestOrder.paymentReferenceNumber}</p>
              )}
          </div>
        </section>
      )}

      {manualOrderError && (
        <p className="form-error-message">{manualOrderError}</p>
      )}
      {errorMessage && <p className="form-error-message">{errorMessage}</p>}

      <div className="admin-pos-layout">
        <section className="admin-pos-menu-section">
          <div className="admin-pos-toolbar">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search menu items"
              aria-label="Search menu items"
              disabled={isCreatingManualOrder}
            />

            <div className="admin-pos-category-tabs">
              <button
                type="button"
                className={`admin-pos-category${showAvailableOnly ? " active" : ""}`}
                onClick={() => setShowAvailableOnly((current) => !current)}
                disabled={isCreatingManualOrder}
                aria-pressed={showAvailableOnly}
              >
                Available Only
              </button>
              {mainCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={
                    activeCategory === category
                      ? "admin-pos-category active"
                      : "admin-pos-category"
                  }
                  onClick={() => setActiveCategory(category)}
                  disabled={isCreatingManualOrder}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? <p>Loading menu items…</p> : filteredMenuItems.length > 0 ? (
            <div className="admin-pos-menu-grid">
              {filteredMenuItems.map((item) => (
                <AdminPosMenuCard
                  key={item.id}
                  item={item}
                  onAddItem={handleAddItem}
                  disabled={isCreatingManualOrder}
                  available={item.isAvailable && Number(item.available) > 0}
                />
              ))}
            </div>
          ) : (
            <div className="admin-pos-empty-menu">
              <h2>{menuItems.length === 0 ? "No menu items found" : "No matching menu items"}</h2>
              <p>Try another search term or category.</p>
            </div>
          )}
        </section>

        <AdminPosCartPanel
          cartItems={cartItems}
          posForm={posForm}
          errors={posErrors}
          onFormChange={handleFormChange}
          onIncreaseQuantity={handleIncreaseQuantity}
          onDecreaseQuantity={handleDecreaseQuantity}
          onRemoveItem={handleRemoveItem}
          onClearCart={handleClearCart}
          onCreateOrder={handleCreateOrder}
          isCreatingOrder={isCreatingManualOrder}
        />
      </div>
    </section>
  );
}

export default AdminPosPage;
