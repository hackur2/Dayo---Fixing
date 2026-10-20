
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useSalesGraphData } from "../../hooks/useSalesGraphData";

import "../../styles/superAdminSalesGraph.css";

function formatPeso(amount) {
  return `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-PH");
}

function isDateInsideRange(date, startDate, endDate) {
  if (!date) {
    return false;
  }

  if (startDate && date < startDate) {
    return false;
  }

  if (endDate && date > endDate) {
    return false;
  }

  return true;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const salesData = payload.find((item) => item.dataKey === "totalSales");
  const ordersData = payload.find((item) => item.dataKey === "totalOrders");

  return (
    <div className="sales-graph-tooltip">
      <strong>{label}</strong>
      <p>Sales: {formatPeso(salesData?.value || 0)}</p>
      <p>Orders: {formatNumber(ordersData?.value || 0)}</p>
    </div>
  );
}

function SuperAdminSalesGraphPage() {
  const [startDate, setStartDate] = useState("2026-03-20");
  const [endDate, setEndDate] = useState("2026-03-27");

  const { salesGraphData, isSalesGraphLoading, salesGraphError } =
    useSalesGraphData(startDate, endDate);

  const filteredSalesGraphData = useMemo(() => {
    return salesGraphData.filter((item) =>
      isDateInsideRange(item.date, startDate, endDate)
    );
  }, [salesGraphData, startDate, endDate]);

  const salesSummary = useMemo(() => {
    const totalSales = filteredSalesGraphData.reduce((total, item) => {
      return total + item.totalSales;
    }, 0);

    const totalOrders = filteredSalesGraphData.reduce((total, item) => {
      return total + item.totalOrders;
    }, 0);

    const averageDailySales =
      filteredSalesGraphData.length > 0
        ? totalSales / filteredSalesGraphData.length
        : 0;

    const highestSalesDay = filteredSalesGraphData.reduce(
      (highestItem, currentItem) => {
        if (!highestItem || currentItem.totalSales > highestItem.totalSales) {
          return currentItem;
        }

        return highestItem;
      },
      null
    );

    return {
      totalSales,
      totalOrders,
      averageDailySales,
      highestSalesDay,
    };
  }, [filteredSalesGraphData]);

  if (isSalesGraphLoading) {
    return (
      <section className="admin-page">
        <div className="admin-page-heading">
          <div>
            <p className="admin-eyebrow"></p>
            <h1>Sales Graph</h1>
            <p>Loading sales graph data...</p>
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
          <h1>Sales Graph</h1>
          <p>
            
          </p>
        </div>
      </div>

      {salesGraphError && (
        <section className="sales-graph-message warning">
          {salesGraphError}
        </section>
      )}

      <section className="sales-graph-filter-card">
        <div className="sales-graph-filter-heading">
          <span>Date Range</span>
          <strong>Sales report period</strong>
        </div>

        <div className="sales-graph-date-fields">
          <label className="sales-graph-date-field" htmlFor="sales-start-date">
            <span>Start Date</span>
            <input
              id="sales-start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>

          <div className="sales-graph-date-arrow">→</div>

          <label className="sales-graph-date-field" htmlFor="sales-end-date">
            <span>End Date</span>
            <input
              id="sales-end-date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="sales-graph-summary-grid">
        <article className="sales-graph-summary-card featured">
          <span>Total Sales</span>
          <strong>{formatPeso(salesSummary.totalSales)}</strong>
          <p></p>
        </article>

        <article className="sales-graph-summary-card">
          <span>Total Orders</span>
          <strong>{formatNumber(salesSummary.totalOrders)}</strong>
          <p></p>
        </article>

        <article className="sales-graph-summary-card">
          <span>Average Daily Sales</span>
          <strong>{formatPeso(salesSummary.averageDailySales)}</strong>
          <p></p>
        </article>

        <article className="sales-graph-summary-card warning">
          <span>Highest Sales Day</span>
          <strong>{salesSummary.highestSalesDay?.date || "—"}</strong>
          <p>
            {salesSummary.highestSalesDay
              ? formatPeso(salesSummary.highestSalesDay.totalSales)
              : "No sales data"}
          </p>
        </article>
      </section>

      <section className="sales-graph-card">
        <div className="sales-graph-card-header">
          <div>
            <h2>Daily Sales Trend</h2>
            <p>
            </p>
          </div>
        </div>

        {filteredSalesGraphData.length > 0 ? (
          <div className="sales-graph-chart-wrapper">
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={filteredSalesGraphData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />

                <Line
                  type="linear"
                  dataKey="totalSales"
                  name="Total Sales"
                  strokeWidth={3}
                  dot
                />

                <Line
                  type="linear"
                  dataKey="totalOrders"
                  name="Total Orders"
                  strokeWidth={3}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <section className="admin-empty-state">
            <h2>No sales data found</h2>
            <p>Try selecting another start date or end date.</p>
          </section>
        )}
      </section>
    </section>
  );
}

export default SuperAdminSalesGraphPage;