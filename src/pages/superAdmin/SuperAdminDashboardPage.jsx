import { Link } from "react-router";

import { SUPER_ADMIN_ROUTES } from "../../constants/routes";
import { useDashboardData } from "../../hooks/useDashboardData";
import { DailyIncomeTargetCard, OrderPipelineCard, OrderSourcesCard } from "../../components/superAdmin/dashboard/DashboardInsightCards";
import { CustomerMapCard, RevenueChartCard } from "../../components/superAdmin/dashboard/DashboardActivityCharts";
import DashboardShelfLifeCard from "../../components/superAdmin/dashboard/DashboardShelfLifeCard";
import DashboardPotentialExcessCard from "../../components/superAdmin/dashboard/DashboardPotentialExcessCard";
import { getDashboardDate } from "../../utils/dashboardUtils";
import { getDashboardShares } from "../../utils/salesAnalysisUtils";
import MetricPercentage from "../../components/common/MetricPercentage";
import CloudSyncControl from "../../components/superAdmin/dashboard/CloudSyncControl";
import OnlineOrderingControl from "../../components/superAdmin/dashboard/OnlineOrderingControl";
import { isLocalDeployment } from "../../config/deployment";

import "../../styles/superAdminDashboard.css";

function formatPeso(amount) {
  return `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-PH");
}

function SuperAdminDashboardPage() {
  const { dashboardData, isDashboardLoading, dashboardError } = useDashboardData();
  const topSellingItems = dashboardData.topSellingItems.slice(0, 5);
  const highestQuantity = Math.max(1, ...topSellingItems.map((item) => item.quantitySold));
  const isUnavailable = isDashboardLoading || Boolean(dashboardError);
  const asOfDate = dashboardData.asOfDate || getDashboardDate(new Date());
  const shares = getDashboardShares(dashboardData);

  return (
    <section className="admin-page super-admin-dashboard-page" aria-busy={isDashboardLoading}>
      <div className="admin-page-heading dashboard-heading">
        <div>
          <h1>Dashboard</h1>
        </div>
        <div className="dashboard-operations-controls">
          <CloudSyncControl />
          {isLocalDeployment && <OnlineOrderingControl />}
        </div>
      </div>

      {isDashboardLoading && <p role="status">Loading dashboard data...</p>}
      {dashboardError && (
        <section className="dashboard-message warning" role="alert">{dashboardError}</section>
      )}

      <section className="dashboard-kpi-grid" aria-label="Business totals">
        <Link to={SUPER_ADMIN_ROUTES.SALES_GRAPH} className="dashboard-kpi-card featured dashboard-card-link">
          <span>Revenue Monitoring</span>
          <strong>{isUnavailable ? "—" : formatPeso(dashboardData.totalSales)}</strong>
          <p>All completed orders</p>
          <MetricPercentage value={shares.revenue} label="of revenue earned today" unavailable={isUnavailable} />
        </Link>

        <Link to={SUPER_ADMIN_ROUTES.ORDERS} className="dashboard-kpi-card dashboard-card-link">
          <span>Total Orders</span>
          <strong>{isUnavailable ? "—" : formatNumber(dashboardData.totalOrders)}</strong>
          <p>All orders in Order Summary</p>
          <MetricPercentage value={shares.orders} label="order completion rate" unavailable={isUnavailable} />
        </Link>

        <Link to={SUPER_ADMIN_ROUTES.LOW_STOCK} className="dashboard-kpi-card warning dashboard-card-link">
          <span>Low Stock</span>
          <strong>{isUnavailable ? "—" : formatNumber(dashboardData.lowStockCount)}</strong>
          <p>Ingredients at reorder level</p>
          <MetricPercentage value={shares.lowStock} label="of active ingredients" unavailable={isUnavailable} />
        </Link>
      </section>

      <section className="dashboard-bento-grid" aria-label="Menu performance">
        <div className="dashboard-menu-stack">
        <article className="dashboard-panel top-menu-panel">
          <div className="dashboard-panel-header">
            <h2>Top Menu</h2>
          </div>

          {isUnavailable ? (
            <div className="dashboard-menu-empty">
              <p>{isDashboardLoading ? "Loading menu sales..." : "Menu sales are unavailable."}</p>
            </div>
          ) : topSellingItems.length > 0 ? (
            <ol className="dashboard-menu-list">
              {topSellingItems.map((item, index) => (
                <li key={item.id ?? item.name} className="dashboard-menu-item">
                  <div className="dashboard-menu-label">
                    <span className="dashboard-menu-rank" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <strong>{item.name}</strong>
                  </div>
                  <div className="dashboard-menu-sales">
                    <div className="dashboard-menu-track" aria-hidden="true">
                      <div className="dashboard-menu-fill" style={{ width: `${(item.quantitySold / highestQuantity) * 100}%` }} />
                    </div>
                    <span className="dashboard-menu-value">{formatNumber(item.quantitySold)} <span>sold</span></span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="dashboard-menu-empty">
              <strong>No menu sales yet</strong>
              <p>Top menu items will appear when orders are completed.</p>
            </div>
          )}
        </article>
        <DashboardShelfLifeCard shelfLife={dashboardData.shelfLife} isUnavailable={isUnavailable} isLoading={isDashboardLoading} />
        </div>

        <RevenueChartCard revenueTrend={dashboardData.revenueTrend} asOfDate={asOfDate} isUnavailable={isUnavailable} />
        <div className="dashboard-audience-stack">
          <OrderSourcesCard sources={dashboardData.orderSources} isUnavailable={isUnavailable} />
          <DailyIncomeTargetCard income={dashboardData.todaySales} isUnavailable={isUnavailable} />
        </div>
        <CustomerMapCard activity={dashboardData.customerActivity} asOfDate={asOfDate} isUnavailable={isUnavailable} />
      </section>

      <section className="dashboard-bottom-grid" aria-label="Operations totals">
        <OrderPipelineCard pipeline={dashboardData.orderPipeline} isUnavailable={isUnavailable} />

        <DashboardPotentialExcessCard estimate={dashboardData.potentialExcess} isUnavailable={isUnavailable} isLoading={isDashboardLoading} />

        <Link to={SUPER_ADMIN_ROUTES.STAFF_SHIFTS} className="dashboard-kpi-card dashboard-card-link dashboard-bottom-metric">
          <span>Active Staff</span>
          <div className="dashboard-bottom-metric-body">
            <strong>{isUnavailable ? "—" : formatNumber(dashboardData.activeStaffCount)}</strong>
            <div className="dashboard-metric-icon staff" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="10" r="5" /><path d="M3 28v-3a10 10 0 0 1 20 0v3M23 5a5 5 0 0 1 0 10M26 19a8 8 0 0 1 3 6v3" /></svg>
            </div>
          </div>
          <p>Currently marked on duty</p>
        </Link>
      </section>
    </section>
  );
}

export default SuperAdminDashboardPage;
