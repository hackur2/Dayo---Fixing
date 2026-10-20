
import { Link, useNavigate } from "react-router";

import { SUPER_ADMIN_ROUTES } from "../../constants/routes";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useDashboardData } from "../../hooks/useDashboardData";
import MetricTrend from "../../components/common/MetricTrend";

import "../../styles/superAdminDashboard.css";

const ORDER_SOURCE_COLORS = {
  "QR Order": "#8a8a8a",
  "Manual POS": "#facc15",
};

function getOrderSourceClassName(source) {
  return String(source || "")
    .toLowerCase()
    .replaceAll(" ", "-");
}


function formatPeso(amount) {
  return `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-PH");
}

function getStockPercentage(item) {
  if (!item.reorderLevel || item.reorderLevel <= 0) {
    return 0;
  }

  return Math.min((item.currentStock / item.reorderLevel) * 100, 100);
}

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const salesData = payload.find((item) => item.dataKey === "totalSales");
  const ordersData = payload.find((item) => item.dataKey === "totalOrders");

  return (
    <div className="dashboard-chart-tooltip">
      <strong>{label}</strong>
      <p>Sales: {formatPeso(salesData?.value || 0)}</p>
      <p>Orders: {formatNumber(ordersData?.value || 0)}</p>
    </div>
  );
}

function SimpleTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="dashboard-chart-tooltip">
      <strong>{label}</strong>
      <p>{formatNumber(payload[0]?.value || 0)} orders</p>
    </div>
  );
}

function SuperAdminDashboardPage() {
  const navigate = useNavigate();

  function handlePipelineBarClick(bar) {
    const status = bar?.payload?.status ?? bar?.status;
    if (["Pending", "Preparing", "Ready", "Completed", "Cancelled"].includes(status)) {
      navigate(`${SUPER_ADMIN_ROUTES.ORDERS}?status=${encodeURIComponent(status)}`);
    }
  }

  const { dashboardData, isDashboardLoading, dashboardError } =
    useDashboardData();

  const revenueTrend = dashboardData.revenueTrend ?? [];
  const orderSources = dashboardData.orderSources ?? [];
  const orderPipeline = dashboardData.orderPipeline ?? [];
  const lowStockItems = dashboardData.lowStockItems ?? [];
  const topSellingItems = dashboardData.topSellingItems ?? [];

  if (isDashboardLoading) {
    return (
      <section className="admin-page">
        <div className="admin-page-heading">
          <div>
            <p className="admin-eyebrow"></p>
            <h1>Dashboard</h1>
            <p>Loading dashboard data...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page super-admin-dashboard-page">
      <div className="admin-page-heading dashboard-heading">
        <div>
          <p className="admin-eyebrow"></p>
          <h1>Dashboard</h1>
          <p>
            
          </p>
        </div>
      </div>

      {dashboardError && (
        <section className="dashboard-message warning">{dashboardError}</section>
      )}

      <section className="dashboard-kpi-grid">
        <Link to={SUPER_ADMIN_ROUTES.SALES_GRAPH} className="dashboard-kpi-card featured dashboard-card-link" aria-label="Open Sales Graph to review total revenue">
          <span>Total Revenue</span>
          <strong>{formatPeso(dashboardData.totalSales)}</strong>
          <MetricTrend current={dashboardData.totalSales} previous={dashboardData.previousPeriodSales} />
        </Link>

        <Link to={SUPER_ADMIN_ROUTES.ORDERS} className="dashboard-kpi-card dashboard-card-link" aria-label="Open Order Summary">
          <span>Orders Today</span>
          <strong>{formatNumber(dashboardData.ordersToday)}</strong>
          <MetricTrend current={dashboardData.ordersToday} previous={dashboardData.previousDayOrders} />
        </Link>

        <Link to={`${SUPER_ADMIN_ROUTES.INVENTORY}?view=menuItems`} className="dashboard-kpi-card dashboard-card-link" aria-label="Open menu items in Inventory">
          <span>Menu Items</span>
          <strong>{formatNumber(dashboardData.menuItemsCount)}</strong>
          <p></p>
        </Link>

      </section>

      <section className="dashboard-bento-grid">
        <article className="dashboard-panel revenue-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2><Link className="dashboard-panel-heading-link" to={SUPER_ADMIN_ROUTES.SALES_GRAPH}>Revenue Trend</Link></h2>
              <p></p>
            </div>
          </div>

          {revenueTrend.length > 0 ? (
            <div className="dashboard-chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip content={<RevenueTooltip />} />
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
              <h2>No revenue data</h2>
              <p>Revenue trend will appear once sales are recorded.</p>
            </section>
          )}
        </article>

        <section className="dashboard-panel top-items-panel">
        <div className="dashboard-panel-header">
          <div>
            <h2>Top 5 Menu Items</h2>
            <p></p>
          </div>
        </div>

        {topSellingItems.length > 0 ? (
          <div className="dashboard-top-items-grid">
            {topSellingItems.slice(0, 5).map((item, index) => (
              <article key={item.id ?? item.name} className="dashboard-top-card">
                <div className="dashboard-top-image-wrap">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="dashboard-top-image"
                  />

                  <span className="dashboard-top-rank">{index + 1}</span>
                </div>

                <div className="dashboard-top-card-body">
                  <strong>{item.name}</strong>
                  <span>{formatNumber(item.quantitySold)} sold</span>
                  <p>{formatPeso(item.revenue)}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="admin-empty-state">
            <h2>No top items yet</h2>
            <p>Top menu items will appear once sales are recorded.</p>
            </section>
        )}
        </section>
        <article className="dashboard-panel pipeline-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2><Link className="dashboard-panel-heading-link" to={SUPER_ADMIN_ROUTES.ORDERS}>Order Pipeline</Link></h2>
              <p></p>
            </div>
          </div>

          {orderPipeline.length > 0 ? (
            <div className="dashboard-chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orderPipeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip content={<SimpleTooltip />} />
                  <Bar dataKey="count" radius={[12, 12, 0, 0]} onClick={handlePipelineBarClick} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <section className="admin-empty-state">
              <h2>No pipeline data</h2>
              <p>Order status count will appear here.</p>
            </section>
          )}
        </article>

        <Link to={`${SUPER_ADMIN_ROUTES.INVENTORY}?view=ingredients&status=Low%20Stock`} className="dashboard-panel low-stock-panel dashboard-card-link" aria-label="Open Inventory filtered to low-stock ingredients">
          <div className="dashboard-panel-header">
            <div>
              <h2>Low Stock Watch</h2>
              <p></p>
            </div>

            <span className="dashboard-panel-count">
              {formatNumber(dashboardData.lowStockCount)}
            </span>
          </div>

          {lowStockItems.length > 0 ? (
            <div className="dashboard-low-stock-list">
              {lowStockItems.map((item) => (
                <div key={item.id ?? item.name} className="dashboard-stock-row">
                  <div className="dashboard-stock-row-top">
                    <strong>{item.name}</strong>
                    <span>
                      {formatNumber(item.currentStock)} /{" "}
                      {formatNumber(item.reorderLevel)} {item.unit}
                    </span>
                  </div>

                  <div className="dashboard-stock-track">
                    <div
                      className="dashboard-stock-fill"
                      style={{ width: `${getStockPercentage(item)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <section className="admin-empty-state">
              <h2>No low stock items</h2>
              <p>Inventory warnings will appear here.</p>
            </section>
          )}
        </Link>
      </section>

        <article className="dashboard-panel order-source-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Order Sources</h2>
              <p></p>
            </div>
          </div>

          {orderSources.length > 0 ? (
            <div className="dashboard-donut-layout">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={orderSources}
                    dataKey="count"
                    nameKey="source"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={4}
                  >
                    {orderSources.map((entry) => (
                      <Cell
                        key={entry.source}
                        fill={ORDER_SOURCE_COLORS[entry.source] || "#8f9779"}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<SimpleTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              <div className="dashboard-source-list">
                {orderSources.map((source) => (
                  <div
                    key={source.source}
                    className={`dashboard-source-item ${getOrderSourceClassName(source.source)}`}
                  >
                    <span>{source.source}</span>
                    <strong>{formatNumber(source.count)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <section className="admin-empty-state">
              <h2>No source data</h2>
              <p>Order source data will appear here.</p>
            </section>
          )}
        </article>



    </section>
  );
}

export default SuperAdminDashboardPage;
