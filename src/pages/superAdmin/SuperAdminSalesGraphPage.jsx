import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSalesGraphData } from "../../hooks/useSalesGraphData";
import SalesAnalysisPanels from "../../components/superAdmin/sales/SalesAnalysisPanels";
import SalesDateRangeHeader from "../../components/superAdmin/sales/SalesDateRangeHeader";
import MetricPercentage from "../../components/common/MetricPercentage";
import { createSalesReportLoader } from "../../services/salesGraphService";
import { buildSalesTrendSeries, summarizeSales } from "../../utils/salesAnalysisUtils";
import "../../styles/superAdminSalesGraph.css";

const formatPeso = (value) => `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatNumber = (value) => Number(value || 0).toLocaleString("en-PH");
const INTERVALS = [["hour", "Hour"], ["day", "Day"], ["week", "Week"], ["month", "Month"]];
const ENTITY_MODES = [["main", "MAIN CATEGORY"], ["subcategory", "SUBCATEGORY"]];

function CustomTooltip({ active, payload }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="sales-graph-tooltip sales-trend-tooltip"><strong>{point.label}</strong>{payload.map((entry) => <p key={entry.dataKey}><span className="sales-trend-tooltip-dot" style={{ background: entry.color }} aria-hidden="true" />{entry.name}: {formatPeso(entry.value)}</p>)}</div>;
}

export default function SuperAdminSalesGraphPage() {
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });
  const [interval, setInterval] = useState("day");
  const [selectedEntityMode, setEntityMode] = useState("main");
  const entityMode = selectedEntityMode === "subcategory" ? "subcategory" : "main";
  const [loadReport] = useState(createSalesReportLoader);
  const { salesReport, isSalesGraphLoading: isLoading, salesGraphError: error } = useSalesGraphData("", "", loadReport);
  const summary = useMemo(() => summarizeSales(salesReport, dateRange), [salesReport, dateRange]);
  const { data: trend, series } = useMemo(() => buildSalesTrendSeries(salesReport, interval, dateRange, entityMode), [salesReport, interval, dateRange, entityMode]);
  const entityLabel = ENTITY_MODES.find(([value]) => value === entityMode)[1];
  const unavailable = isLoading || Boolean(error);
  const intervalDescription = interval === "hour" ? "Hour of day · Philippine time" : interval === "week" ? "Weeks start Monday" : interval === "month" ? "Calendar months" : "Daily totals";

  return (
    <section className="admin-page sales-graph-page" aria-busy={isLoading}>
      <div className="admin-page-heading"><div><h1>Sales Graph</h1></div></div>
      {error && <section className="sales-graph-message warning" role="alert">{error}</section>}
      <section className="sales-graph-summary-grid" aria-label="Sales performance">
        <article className="sales-graph-summary-card featured">
          <span>Total Sales</span><strong>{unavailable ? "—" : formatPeso(summary.totalSales)}</strong>
          <MetricPercentage value={summary.salesShare} label="of all-time completed sales" unavailable={unavailable} />
        </article>
        <article className="sales-graph-summary-card">
          <span>Total Orders</span><strong>{unavailable ? "—" : formatNumber(summary.totalOrders)}</strong>
          <MetricPercentage value={summary.ordersShare} label="of all-time completed orders" unavailable={unavailable} />
        </article>
        <article className="sales-graph-summary-card">
          <span>Average Daily Sales</span><strong>{unavailable ? "—" : formatPeso(summary.averageDailySales)}</strong>
          <MetricPercentage value={summary.averageToPeak} label="of peak daily sales" unavailable={unavailable} />
        </article>
        <article className="sales-graph-summary-card warning">
          <span>Highest Sales Day</span><strong>{unavailable ? "—" : summary.highestSalesDay?.key || "—"}</strong>
          <p>{unavailable ? "—" : summary.highestSalesDay ? formatPeso(summary.highestSalesDay.totalSales) : "No sales data"}</p>
          <MetricPercentage value={summary.peakShare} label="of selected-period revenue" unavailable={unavailable} />
        </article>
      </section>
      <section className="sales-graph-card sales-trend-card" aria-labelledby="daily-sales-trend-title">
        <SalesDateRangeHeader title="Sales Trend" titleId="daily-sales-trend-title" description={intervalDescription} range={dateRange} onApply={setDateRange} controls={<>
          <div className="sales-trend-intervals" role="group" aria-label="Sales trend interval">
            {INTERVALS.map(([value, label]) => <button type="button" key={value} aria-pressed={interval === value} onClick={() => setInterval(value)}>{label}</button>)}
          </div>
          <select className="sales-trend-entity-select" aria-label="Sales trend entity" value={entityMode} onChange={(event) => setEntityMode(event.target.value)} disabled={unavailable}>
            {ENTITY_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </>} />
        {isLoading ? <div className="sales-graph-loading" role="status">Loading sales graph data...</div>
          : error ? <p className="sales-chart-note">Sales data is unavailable.</p>
          : summary.totalOrders > 0 && series.length > 0 ? <>
            <div className="sales-graph-chart-wrapper" role="img" aria-label={`${INTERVALS.find(([value]) => value === interval)[1]} sales trend · ${entityLabel}: ${series.map((entity) => entity.name).join(", ")}. Sales in pesos.`}>
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={trend} margin={{ top: 10, right: 8, left: 8, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" minTickGap={28} tick={{ fontSize: 11 }} tickFormatter={(label) => interval === "week" ? label.replace("Week of ", "") : label} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `₱${formatNumber(value)}`} width={70} />
                  <Tooltip content={<CustomTooltip />} wrapperStyle={{ pointerEvents: "auto" }} />
                  <Legend height={72} wrapperStyle={{ fontSize: 12, maxHeight: 72, overflowY: "auto" }} />
                  {series.map((entity, index) => <Line key={entity.id} type="linear" dataKey={entity.key} name={entity.name} stroke={`hsl(${index * 137.508 % 360} 55% 42%)`} strokeWidth={2} dot={trend.length < 40} />)}
                </LineChart>
              </ResponsiveContainer>
            </div>

          </> : <section className="admin-empty-state"><h2>{summary.totalOrders > 0 ? "No entities in this group" : "No sales data found"}</h2><p>{summary.totalOrders > 0 ? "Try another entity group." : "Try selecting another date range."}</p></section>}
      </section>
      <SalesAnalysisPanels loadReport={loadReport} />
    </section>
  );
}
