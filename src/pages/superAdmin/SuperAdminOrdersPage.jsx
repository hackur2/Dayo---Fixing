
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { useSuperAdminOrdersData } from "../../hooks/useSuperAdminOrdersData";
import SortableHeader from "../../components/common/SortableHeader";
import { getOrderDateTime, sortRecords } from "../../utils/sortUtils";

import "../../styles/superAdminOrders.css";

const STATUS_OPTIONS = [
  "All",
  "Pending",
  "Preparing",
  "Ready",
  "Completed",
  "Cancelled",
];

const SOURCE_OPTIONS = ["All", "QR Order", "Manual POS"];

function formatPeso(amount) {
  return `₱${Number(amount).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getBadgeClassName(value) {
  return value.toLowerCase().replaceAll(" ", "-");
}

function SuperAdminOrdersPage() {
  const [searchParams] = useSearchParams();
  const requestedStatus = searchParams.get("status");
  const initialStatus = STATUS_OPTIONS.includes(requestedStatus) ? requestedStatus : "All";
  const { orders, isOrdersLoading, ordersError } = useSuperAdminOrdersData();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  useEffect(() => {
    setStatusFilter(initialStatus);
  }, [initialStatus]);
  const [sourceFilter, setSourceFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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

  const dateFilteredOrders = useMemo(() => orders.filter((order) => {
    const date = order.orderDate || order.createdAt?.slice(0, 10) || "";
    return (!startDate || date >= startDate) && (!endDate || date <= endDate);
  }), [orders, startDate, endDate]);

  const orderSummary = useMemo(() => {
    const completedOrders = dateFilteredOrders.filter(
      (order) => order.status === "Completed"
    );

    const activeOrders = dateFilteredOrders.filter((order) =>
      ["Pending", "Preparing", "Ready"].includes(order.status)
    );

    const cancelledOrders = dateFilteredOrders.filter(
      (order) => order.status === "Cancelled"
    );

    const totalRevenue = completedOrders.reduce(
      (total, order) => total + order.totalAmount,
      0
    );

    return {
      totalOrders: dateFilteredOrders.length,
      activeOrders: activeOrders.length,
      completedOrders: completedOrders.length,
      cancelledOrders: cancelledOrders.length,
      totalRevenue,
    };
  }, [dateFilteredOrders]);

  const filteredOrders = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    const matches = dateFilteredOrders.filter((order) => {
      const matchesSearch =
        searchValue === "" ||
        order.orderNumber.toLowerCase().includes(searchValue) ||
        order.customerName.toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === "All" || order.status === statusFilter;

      const matchesSource =
        sourceFilter === "All" || order.source === sourceFilter;

      return matchesSearch && matchesStatus && matchesSource;
    });

    const getters = {
      date: [(order) => getOrderDateTime(order), "date"],
      customer: [(order) => order.customerName, "text"],
      orderNumber: [(order) => order.orderNumber, "text"],
      source: [(order) => order.source, "text"],
      status: [(order) => order.status, "text"],
      payment: [(order) => order.paymentStatus, "text"],
      total: [(order) => order.totalAmount, "number"],
    };
    const [getter, type] = getters[sortBy];
    return sortRecords(matches, getter, sortDirection, type);
  }, [dateFilteredOrders, searchTerm, statusFilter, sourceFilter, sortBy, sortDirection]);

  if (isOrdersLoading) {
    return (
      <section className="admin-page">
        <div className="admin-page-heading">
          <div>
            <p className="admin-eyebrow"></p>
            <h1>Order Summary</h1>
            <p>Loading order records...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow"></p>
          <h1>Order Summary</h1>
          <p>
          </p>
        </div>
      </div>

      {ordersError && (
        <section className="orders-message warning">{ordersError}</section>
      )}

      <section className="orders-summary-grid">
        <article className="orders-summary-card featured">
          <span>Total Revenue</span>
          <strong>{formatPeso(orderSummary.totalRevenue)}</strong>
          <p></p>
        </article>

        <article className="orders-summary-card">
          <span>Total Orders</span>
          <strong>{orderSummary.totalOrders}</strong>
          <p></p>
        </article>

        <article className="orders-summary-card">
          <span>Active Orders</span>
          <strong>{orderSummary.activeOrders}</strong>
          <p></p>
        </article>

        <article className="orders-summary-card danger">
          <span>Cancelled</span>
          <strong>{orderSummary.cancelledOrders}</strong>
          <p></p>
        </article>
      </section>

      <section className="orders-toolbar">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search order number or customer"
          aria-label="Search order number or customer"
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

        <input
          type="date"
          value={startDate}
          max={endDate || undefined}
          onChange={(event) => setStartDate(event.target.value)}
          aria-label="Filter orders from date"
          title="From date"
        />

        <input
          type="date"
          value={endDate}
          min={startDate || undefined}
          onChange={(event) => setEndDate(event.target.value)}
          aria-label="Filter orders through date"
          title="Through date"
        />

        <button
          type="button"
          className="orders-clear-date-button"
          onClick={() => { setStartDate(""); setEndDate(""); }}
          disabled={!startDate && !endDate}
        >
          Clear dates
        </button>

        <select
          value={sourceFilter}
          onChange={(event) => setSourceFilter(event.target.value)}
          aria-label="Filter by order source"
        >
          {SOURCE_OPTIONS.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </section>

      <section className="orders-table-card">
        <div className="orders-table-header">
          <div>
            <h2>Order Records</h2>
            <p>{filteredOrders.length} result(s)</p>
          </div>
        </div>

        {filteredOrders.length > 0 ? (
          <table className="orders-table">
            <thead>
              <tr>
                <SortableHeader label="Order No." column="orderNumber" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <SortableHeader label="Customer" column="customer" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <SortableHeader label="Source" column="source" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <SortableHeader label="Date & Time" column="date" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <SortableHeader label="Status" column="status" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <SortableHeader label="Payment" column="payment" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <SortableHeader label="Total" column="total" sortBy={sortBy} direction={sortDirection} onSort={handleSortColumn} />
                <th></th>
              </tr>
            </thead>

            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.orderNumber}</strong>
                  </td>

                  <td>{order.customerName}</td>

                  <td>{order.source}</td>

                  <td>
                    {order.orderDate}
                    <br />
                    <span>{order.orderTime}</span>
                  </td>

                  <td>
                    <span
                      className={`orders-status-badge ${getBadgeClassName(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`orders-payment-badge ${getBadgeClassName(
                        order.paymentStatus
                      )}`}
                    >
                      {order.paymentStatus}
                    </span>
                  </td>

                  <td>{formatPeso(order.totalAmount)}</td>

                  <td>
                    <button
                      type="button"
                      className="secondary-button orders-small-button"
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
            <p>Try changing the search keyword, status, or source filter.</p>
          </section>
        )}
      </section>

      {selectedOrder && (
        <div className="orders-modal-backdrop">
          <section className="orders-modal">
            <div className="orders-modal-header">
              <div>
                <p className="admin-eyebrow">Order Details</p>
                <h2>{selectedOrder.orderNumber}</h2>
              </div>

              <button type="button" onClick={() => setSelectedOrder(null)}>
                ×
              </button>
            </div>

            <div className="orders-details-grid">
              <article>
                <span>Customer</span>
                <strong>{selectedOrder.customerName}</strong>
              </article>

              <article>
                <span>Source</span>
                <strong>{selectedOrder.source}</strong>
              </article>

              <article>
                <span>Status</span>
                <strong>{selectedOrder.status}</strong>
              </article>

              <article>
                <span>Payment</span>
                <strong>{selectedOrder.paymentStatus}</strong>
              </article>

              <article>
                <span>Payment Method</span>
                <strong>{selectedOrder.paymentMethod}</strong>
              </article>

              <article>
                <span>Date & Time</span>
                <strong>
                  {selectedOrder.orderDate} — {selectedOrder.orderTime}
                </strong>
              </article>
            </div>

            <div className="orders-modal-items">
              <h3>Items Ordered</h3>

              {selectedOrder.items.map((item) => (
                <div key={item.id} className="orders-modal-item-row">
                  <div>
                    <strong>{item.name}</strong>
                    <p>
                      {item.quantity} × {formatPeso(item.price)}
                    </p>
                  </div>

                  <span>{formatPeso(item.quantity * item.price)}</span>
                </div>
              ))}
            </div>

            <div className="orders-modal-vat">
              <span>VAT</span>
              <strong>{formatPeso(0)}</strong>
            </div>

            <div className="orders-modal-total">
              <span>Total Amount</span>
              <strong>{formatPeso(selectedOrder.totalAmount)}</strong>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default SuperAdminOrdersPage;
