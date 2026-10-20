
import { useMemo } from "react";

import KdsOrderCard from "../../components/admin/KdsOrderCard";

import { useKdsOrders } from "../../hooks/useKdsOrders";

import "../../styles/adminKds.css";

const KDS_VISIBLE_STATUSES = ["Pending", "Preparing", "Ready"];

function AdminKdsPage() {
  const {
    kdsOrders,
    isLoadingKdsOrders,
    kdsError,
    updateKdsOrderStatus,
    cancelKdsOrder,
  } = useKdsOrders();

  const visibleOrders = kdsOrders.filter((order) =>
    KDS_VISIBLE_STATUSES.includes(order.status)
  );

  const orderCounts = useMemo(() => {
    return {
      pending: visibleOrders.filter((order) => order.status === "Pending")
        .length,
      preparing: visibleOrders.filter((order) => order.status === "Preparing")
        .length,
      ready: visibleOrders.filter((order) => order.status === "Ready").length,
    };
  }, [visibleOrders]);

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow"></p>
          <h1>Kitchen Display System</h1>
          <p>

          </p>
        </div>
      </div>

      {isLoadingKdsOrders && (
        <p className="admin-loading-text">Loading KDS orders...</p>
      )}

      {kdsError && <p className="form-error-message">{kdsError}</p>}

      <section className="kds-summary-grid" aria-label="KDS order summary">
        <article>
          <span>Pending</span>
          <strong>{orderCounts.pending}</strong>
        </article>

        <article>
          <span>Preparing</span>
          <strong>{orderCounts.preparing}</strong>
        </article>

        <article>
          <span>Ready</span>
          <strong>{orderCounts.ready}</strong>
        </article>
      </section>

      {visibleOrders.length > 0 ? (
        <section className="kds-board">
          {visibleOrders.map((order) => (
            <KdsOrderCard
              key={order.orderNumber}
              order={order}
              onUpdateStatus={updateKdsOrderStatus}
              onCancelOrder={cancelKdsOrder}
            />
          ))}
        </section>
      ) : (
        <section className="admin-empty-state">
          <h2>No active orders</h2>
          <p>Pending, preparing, and ready orders will appear here.</p>
        </section>
      )}
    </section>
  );
}

export default AdminKdsPage;