import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router";

import ProtectedRoute from "../components/auth/ProtectedRoute";
import LoadingState from "../components/common/LoadingState";
import CustomerAccessGate from "../components/customer/CustomerAccessGate";
import AdminShell from "../components/layout/AdminShell";

import {
  ADMIN_ROUTES,
  AUTH_ROUTES,
  CUSTOMER_ROUTES,
  SUPER_ADMIN_ROUTES,
} from "../constants/routes";

import {
  ADMIN_ALLOWED_ROLES,
  SUPER_ADMIN_ALLOWED_ROLES,
} from "../constants/userRoles";

import {
  ADMIN_NAV_LINKS,
  SUPER_ADMIN_NAV_LINKS,
} from "../constants/navigation";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { saveOrderInHistory } from "../utils/customerOrderHistoryUtils";
import { orderService } from "../services/orderService";

import { useSubmitOrder } from "../hooks/useSubmitOrder";

import {
  addItemToCart,
  decreaseItemQuantity,
  removeItemFromCart,
} from "../utils/cartUtils";

// Load only the page visited. Management pages stay out of the customer bundle.
// Keep lazy() declarations at module scope to preserve component state.
const LoginPage = lazy(() => import("../pages/auth/LoginPage"));
const CustomerMenuPage = lazy(() => import("../pages/customer/CustomerMenuPage"));
const CustomerCartPage = lazy(() => import("../pages/customer/CustomerCartPage"));
const CustomerCheckoutPage = lazy(() => import("../pages/customer/CustomerCheckoutPage"));
const CustomerOrderStatusPage = lazy(() => import("../pages/customer/CustomerOrderStatusPage"));
const CustomerFeedbackPage = lazy(() => import("../pages/customer/CustomerFeedbackPage"));
const CustomerNotFoundPage = lazy(() => import("../pages/customer/CustomerNotFoundPage"));
const AdminKdsPage = lazy(() => import("../pages/admin/AdminKdsPage"));
const AdminPosPage = lazy(() => import("../pages/admin/AdminPosPage"));
const AdminOrderSummaryPage = lazy(() => import("../pages/admin/AdminOrderSummaryPage"));
const SuperAdminDashboardPage = lazy(() => import("../pages/superAdmin/SuperAdminDashboardPage"));
const SuperAdminSalesGraphPage = lazy(() => import("../pages/superAdmin/SuperAdminSalesGraphPage"));
const SuperAdminInventoryPage = lazy(() => import("../pages/superAdmin/SuperAdminInventoryPage"));
const SuperAdminOrdersPage = lazy(() => import("../pages/superAdmin/SuperAdminOrdersPage"));
const SuperAdminStaffShiftsPage = lazy(() => import("../pages/superAdmin/SuperAdminStaffShiftsPage"));
const SuperAdminFeedbackPage = lazy(() => import("../pages/superAdmin/SuperAdminFeedbackPage"));
const SuperAdminQrAccessPage = lazy(() => import("../pages/superAdmin/SuperAdminQrAccessPage"));


function getInitialStorageValue(key, fallbackValue) {
  const storedValue = localStorage.getItem(key);

  if (!storedValue) {
    return fallbackValue;
  }

  try {
    return JSON.parse(storedValue);
  } catch (error) {
    console.error(`Unable to parse ${key}:`, error);
    localStorage.removeItem(key);
    return fallbackValue;
  }
}

function clearLegacyDemoStorage() {
  const marker = "dayo_real_data_initialized_v1";
  if (localStorage.getItem(marker)) return;
  [STORAGE_KEYS.CART_ITEMS, STORAGE_KEYS.CURRENT_ORDER, STORAGE_KEYS.CUSTOMER_ORDERS,
    "dayo_customer_feedback_list", "dayo_auth_user"].forEach((key) => localStorage.removeItem(key));
  localStorage.setItem(marker, "true");
}

function AppRoutes() {
  const [cartItems, setCartItems] = useState(() =>
    (clearLegacyDemoStorage(), getInitialStorageValue(STORAGE_KEYS.CART_ITEMS, []))
  );

  const [currentOrder, setCurrentOrder] = useState(() =>
    getInitialStorageValue(STORAGE_KEYS.CURRENT_ORDER, null)
  );

  // Keep previous orders available after starting another checkout.
  // Include an older saved current order when upgrading from earlier revisions.
  const [orderHistory, setOrderHistory] = useState(() => {
    const stored = getInitialStorageValue(STORAGE_KEYS.CUSTOMER_ORDERS, []);
    return currentOrder ? saveOrderInHistory(stored, currentOrder) :
      (Array.isArray(stored) ? stored : []);
  });

  const {
    submitOrder,
    isSubmittingOrder,
    submitOrderError,
  } = useSubmitOrder();

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.CART_ITEMS,
      JSON.stringify(cartItems)
    );
  }, [cartItems]);

  useEffect(() => {
    if (currentOrder) {
      localStorage.setItem(
        STORAGE_KEYS.CURRENT_ORDER,
        JSON.stringify(currentOrder)
      );
      return;
    }

    localStorage.removeItem(STORAGE_KEYS.CURRENT_ORDER);
  }, [currentOrder]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOMER_ORDERS, JSON.stringify(orderHistory));
    } catch (error) {
      console.warn("Unable to save order history in this browser:", error);
    }
  }, [orderHistory]);

  // Status updates from the server must reach both the active view and the saved list.
  const handleOrderUpdated = useCallback((updatedOrder) => {
    if (!updatedOrder?.orderNumber) return;

    setCurrentOrder((previousOrder) => {
      if (previousOrder?.orderNumber !== updatedOrder.orderNumber) return previousOrder;
      if (previousOrder.status === updatedOrder.status) return previousOrder;
      return { ...previousOrder, ...updatedOrder };
    });

    setOrderHistory((previousOrders) =>
      saveOrderInHistory(previousOrders, updatedOrder)
    );
  }, []);

  function handleSelectOrder(orderNumber) {
    const savedOrder = orderHistory.find((order) => order.orderNumber === orderNumber);
    if (savedOrder) setCurrentOrder(savedOrder);
  }

  async function handleCancelCustomerOrder(orderNumber) {
    const updatedOrder = await orderService.cancelCustomerOrder(orderNumber);
    handleOrderUpdated(updatedOrder);
    return updatedOrder;
  }

  function handleAddToCart(item, selectedVariant = null, quantity = 1) {
    setCartItems((currentCartItems) =>
      addItemToCart(
        currentCartItems,
        item,
        selectedVariant,
        quantity
      )
    );
  }

  function handleIncreaseQuantity(
    item,
    selectedVariant = null,
    quantity = 1
  ) {
    setCartItems((currentCartItems) =>
      addItemToCart(
        currentCartItems,
        item,
        selectedVariant,
        quantity
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

  async function handleSubmitOrder(checkoutData = {}) {
    const createdOrder = await submitOrder(checkoutData, cartItems);

    setCurrentOrder(createdOrder);
    setOrderHistory((previousOrders) =>
      saveOrderInHistory(previousOrders, createdOrder)
    );
    setCartItems([]);

    return createdOrder;
  }

  function handleStartNewOrder() {
    // A new bag does not mean that an earlier order was cancelled or deleted.
    setCartItems([]);
  }

  return (
    <Suspense fallback={<LoadingState message="Loading page..." />}>
      <Routes>
      <Route path="/" element={<Navigate to={CUSTOMER_ROUTES.MENU} replace />} />

      <Route path={AUTH_ROUTES.LOGIN} element={<LoginPage />} />

      <Route
        path={CUSTOMER_ROUTES.ACCESS}
        element={<Navigate to={`${CUSTOMER_ROUTES.MENU}?scan=1`} replace />}
      />

      {/* CUSTOMER ROUTES - QR SESSION PROTECTED */}
      <Route
        path={CUSTOMER_ROUTES.MENU}
        element={
          <CustomerAccessGate>
            <CustomerMenuPage
              cartItems={cartItems}
              currentOrder={currentOrder}
              onAddToCart={handleAddToCart}
              onDecreaseQuantity={handleDecreaseQuantity}
            />
          </CustomerAccessGate>
        }
      />

      <Route
        path={CUSTOMER_ROUTES.BAG}
        element={
          <CustomerAccessGate>
            <CustomerCartPage
              cartItems={cartItems}
              onIncreaseQuantity={handleIncreaseQuantity}
              onDecreaseQuantity={handleDecreaseQuantity}
              onRemoveItem={handleRemoveItem}
              onClearCart={handleClearCart}
            />
          </CustomerAccessGate>
        }
      />

      <Route
        path={CUSTOMER_ROUTES.CHECKOUT}
        element={
          <CustomerAccessGate>
            <CustomerCheckoutPage
              cartItems={cartItems}
              onPlaceOrder={handleSubmitOrder}
              isSubmittingOrder={isSubmittingOrder}
              submitOrderError={submitOrderError}
            />
          </CustomerAccessGate>
        }
      />

      <Route
        path={CUSTOMER_ROUTES.ORDER_STATUS}
        element={
          <CustomerAccessGate>
            <CustomerOrderStatusPage
              currentOrder={currentOrder}
              orderHistory={orderHistory}
              onSelectOrder={handleSelectOrder}
              onOrderUpdated={handleOrderUpdated}
              onCancelOrder={handleCancelCustomerOrder}
              onStartNewOrder={handleStartNewOrder}
            />
          </CustomerAccessGate>
        }
      />

      {/* Keep older shared/bookmarked links working after the terminology update. */}
      <Route
        path="/customer/receipt"
        element={<Navigate to={CUSTOMER_ROUTES.ORDER_STATUS} replace />}
      />

      <Route
        path={CUSTOMER_ROUTES.ID_NUMBER}
        element={<Navigate to={CUSTOMER_ROUTES.ORDER_STATUS} replace />}
      />

      <Route
        path={CUSTOMER_ROUTES.FEEDBACK}
        element={
          <CustomerAccessGate>
            <CustomerFeedbackPage currentOrder={currentOrder} />
          </CustomerAccessGate>
        }
      />

      {/* ADMIN ROUTES - PROTECTED WITH ADMIN SIDEBAR */}
      <Route
        path={ADMIN_ROUTES.KDS}
        element={
          <ProtectedRoute allowedRoles={ADMIN_ALLOWED_ROLES}>
            <AdminShell roleName="Admin" navLinks={ADMIN_NAV_LINKS}>
              <AdminKdsPage />
            </AdminShell>
          </ProtectedRoute>
        }
      />

      <Route
        path={ADMIN_ROUTES.POS}
        element={
          <ProtectedRoute allowedRoles={ADMIN_ALLOWED_ROLES}>
            <AdminShell roleName="Admin" navLinks={ADMIN_NAV_LINKS}>
              <AdminPosPage panelLabel="" />
            </AdminShell>
          </ProtectedRoute>
        }
      />

      <Route
        path={ADMIN_ROUTES.ORDER_SUMMARY}
        element={
          <ProtectedRoute allowedRoles={ADMIN_ALLOWED_ROLES}>
            <AdminShell roleName="Admin" navLinks={ADMIN_NAV_LINKS}>
              <AdminOrderSummaryPage />
            </AdminShell>
          </ProtectedRoute>
        }
      />

      {/* SUPER ADMIN ROUTES - PROTECTED WITH SUPER ADMIN SIDEBAR */}
      <Route
        path={SUPER_ADMIN_ROUTES.KDS}
        element={
          <ProtectedRoute allowedRoles={SUPER_ADMIN_ALLOWED_ROLES}>
            <AdminShell
              roleName="Super Admin"
              navLinks={SUPER_ADMIN_NAV_LINKS}
            >
              <AdminKdsPage />
            </AdminShell>
          </ProtectedRoute>
        }
      />

      <Route
        path={SUPER_ADMIN_ROUTES.DASHBOARD}
        element={
          <ProtectedRoute allowedRoles={SUPER_ADMIN_ALLOWED_ROLES}>
            <AdminShell
              roleName="Super Admin"
              navLinks={SUPER_ADMIN_NAV_LINKS}
            >
              <SuperAdminDashboardPage />
            </AdminShell>
          </ProtectedRoute>
        }
      />

      <Route
        path={SUPER_ADMIN_ROUTES.SALES_GRAPH}
        element={
          <ProtectedRoute allowedRoles={SUPER_ADMIN_ALLOWED_ROLES}>
            <AdminShell
              roleName="Super Admin"
              navLinks={SUPER_ADMIN_NAV_LINKS}
            >
              <SuperAdminSalesGraphPage />
            </AdminShell>
          </ProtectedRoute>
        }
      />


      <Route
        path={SUPER_ADMIN_ROUTES.POS}
        element={
          <ProtectedRoute allowedRoles={SUPER_ADMIN_ALLOWED_ROLES}>
            <AdminShell
              roleName="Super Admin"
              navLinks={SUPER_ADMIN_NAV_LINKS}
            >
              <AdminPosPage panelLabel="" />
            </AdminShell>
          </ProtectedRoute>
        }
      />

      <Route
        path={SUPER_ADMIN_ROUTES.INVENTORY}
        element={
          <ProtectedRoute allowedRoles={SUPER_ADMIN_ALLOWED_ROLES}>
            <AdminShell
              roleName="Super Admin"
              navLinks={SUPER_ADMIN_NAV_LINKS}
            >
              <SuperAdminInventoryPage />
            </AdminShell>
          </ProtectedRoute>
        }
      />

      <Route
        path={SUPER_ADMIN_ROUTES.ORDERS}
        element={
          <ProtectedRoute allowedRoles={SUPER_ADMIN_ALLOWED_ROLES}>
            <AdminShell
              roleName="Super Admin"
              navLinks={SUPER_ADMIN_NAV_LINKS}
            >
              <SuperAdminOrdersPage />
            </AdminShell>
          </ProtectedRoute>
        }
      />

      <Route
        path={SUPER_ADMIN_ROUTES.STAFF_SHIFTS}
        element={
          <ProtectedRoute allowedRoles={SUPER_ADMIN_ALLOWED_ROLES}>
            <AdminShell
              roleName="Super Admin"
              navLinks={SUPER_ADMIN_NAV_LINKS}
            >
              <SuperAdminStaffShiftsPage />
            </AdminShell>
          </ProtectedRoute>
        }
      />

      <Route
        path={SUPER_ADMIN_ROUTES.FEEDBACK}
        element={
          <ProtectedRoute allowedRoles={SUPER_ADMIN_ALLOWED_ROLES}>
            <AdminShell
              roleName="Super Admin"
              navLinks={SUPER_ADMIN_NAV_LINKS}
            >
              <SuperAdminFeedbackPage />
            </AdminShell>
          </ProtectedRoute>
        }
      />

      <Route
        path={SUPER_ADMIN_ROUTES.QR_ACCESS}
        element={
          <ProtectedRoute allowedRoles={SUPER_ADMIN_ALLOWED_ROLES}>
            <AdminShell
              roleName="Super Admin"
              navLinks={SUPER_ADMIN_NAV_LINKS}
            >
              <SuperAdminQrAccessPage />
            </AdminShell>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<CustomerNotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
