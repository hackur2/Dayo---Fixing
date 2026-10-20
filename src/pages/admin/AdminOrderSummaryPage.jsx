
import { useMemo, useState } from "react";

import AdminOrderDetailsModal from "../../components/admin/AdminOrderDetailsModal";
import SortableHeader from "../../components/common/SortableHeader";
import { getOrderDateTime, sortRecords } from "../../utils/sortUtils";

import { useAdminOrders } from "../../hooks/useAdminOrders";

import "../../styles/adminOrderSummary.css";

const STATUS_OPTIONS = [
  "All",
  "Pending",
  "Preparing",
  "Ready",
  "Completed",
  "Cancelled",
];

function formatDateTime(value) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AdminOrderSummaryPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [selectedOrder, setSelectedOrder] = useState(null);

  function handleSortColumn(column) {
    setSortDirection((currentDirection) =>
      sortBy === column
        ? currentDirection === "asc" ? "desc" : "asc"
        : column === "date" ? "desc" : "asc"
    );
    setSortBy(column);
  }

  const {
    adminOrders,
    isLoadingAdminOrders,
    adminOrdersError,
  } = useAdminOrders(statusFilter);

  const filteredOrders = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    const matches = adminOrders.filter((order) => {
      const matchesStatus =
        statusFilter === "All" || order.status === statusFilter;

      const matchesSearch =
        searchValue === "" ||
        order.orderNumber.toLowerCase().includes(searchValue) ||
        order.customerName.toLowerCase().includes(searchValue) ||
        order.orderType.toLowerCase().includes(searchValue);

      return matchesStatus && matchesSearch;
    });

    const getters = {
      date: [(order) => getOrderDateTime(order), "date"],
      customer: [(order) => order.customerName, "text"],
      orderNumber: [(order) => order.orderNumber, "text"],
      status: [(order) => order.status, "text"],
      total: [(order) => order.totalAmount, "number"],
    };
    const [getter, type] = getters[sortBy];
    return sortRecords(matches, getter, sortDirection, type);
  }, [adminOrders, searchTerm, statusFilter, sortBy, sortDirection]);

  const summary = useMemo(() => {
    const completedOrders = adminOrders.filter(
      (order) => order.status === "Completed"
    );

    const totalSales = completedOrders.reduce(
      (total, order) => total + order.totalAmount,
      0
    );

    return {
      totalOrders: adminOrders.length,
      completedOrders: completedOrders.length,
      activeOrders: adminOrders.filter((order) =>
        ["Pending", "Preparing", "Ready"].includes(order.status)
      ).length,
      totalSales,
    };
  }, [adminOrders]);

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <div>
          
          <h1>Order Summary</h1>
          <p></p>
        </div>
      </div>

      {isLoadingAdminOrders && (
        <p className="admin-loading-text">Loading orders...</p>
      )}

      {adminOrdersError && (
        <p className="form-error-message">{adminOrdersError}</p>
      )}

      <section className="admin-order-summary-grid">
        <article>
          <span>Total Orders</span>
          <strong>{summary.totalOrders}</strong>
        </article>

        <article>
          <span>Active Orders</span>
          <strong>{summary.activeOrders}</strong>
        </article>

        <article>
          <span>Completed Orders</span>
          <strong>{summary.completedOrders}</strong>
        </article>

        <article>
          <span>Completed Sales</span>
          <strong>₱{summary.totalSales.toFixed(2)}</strong>
        </article>
      </section>

      <section className="admin-order-toolbar">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search order number, customer type, or feedback type"
          aria-label="Search orders"
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by order status"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </section>

      <section className="admin-order-table-card">
        <div className="admin-order-table-header">
          <h2>Orders</h2>
          <p>{filteredOrders.length} result(s)</p>
        </div>

        {filteredOrders.length > 0 ? (
          <table className="admin-order-table">
            <thead>
              <tr>
                <SortableHeader label="Order No." column="orderNumber" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <SortableHeader label="Customer" column="customer" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <th>Type</th>
                <SortableHeader label="Status" column="status" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <SortableHeader label="Total" column="total" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <SortableHeader label="Date/Time" column="date" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.orderNumber}>
                  <td>{order.orderNumber}</td>
                  <td>{order.customerName}</td>
                  <td>{order.orderType}</td>
                  <td>
                    <span
                      className={`admin-order-status ${order.status.toLowerCase()}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td>₱{order.totalAmount.toFixed(2)}</td>
                  <td>{formatDateTime(order.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="primary-button admin-table-action-button"
                      onClick={() => setSelectedOrder(order)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <section className="admin-empty-state">
            <h2>No orders found</h2>
            <p>Try changing the search keyword or status filter.</p>
          </section>
        )}
      </section>

      <AdminOrderDetailsModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </section>
  );
}

export default AdminOrderSummaryPage;