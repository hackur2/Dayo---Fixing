import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { SUPER_ADMIN_ROUTES } from "../../../constants/routes";
import { buildCustomerActivity, buildRevenueTimeline, getRevenueDateRange } from "../../../utils/dashboardUtils";
import DashboardRevenueFilter from "./DashboardRevenueFilter";

const formatPeso = (value) => `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const compactPeso = (value) => `₱${Number(value).toLocaleString("en-PH", { notation: "compact", maximumFractionDigits: 1 })}`;
const formatDate = (value) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const formatRange = (start, end) => start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;

function RevenueTooltip({ active, payload, compare }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return <div className="dashboard-revenue-tooltip">
    <strong>{formatRange(row.startDate, row.endDate)}</strong>
    <p>Revenue: {formatPeso(row.totalSales)}</p>
    {compare && <><small>{formatRange(row.previousStartDate, row.previousEndDate)}</small><p>Previous: {formatPeso(row.previousSales)}</p></>}
  </div>;
}

export function RevenueChartCard({ revenueTrend, asOfDate, isUnavailable }) {
  const [selection, setSelection] = useState({ preset: "last30", startDate: "", endDate: "" });
  const [compare, setCompare] = useState(false);
  const range = useMemo(() => selection.preset === "custom" ? selection : getRevenueDateRange(revenueTrend, asOfDate, selection.preset), [revenueTrend, asOfDate, selection]);
  const timeline = useMemo(() => buildRevenueTimeline(revenueTrend, range.startDate, range.endDate), [revenueTrend, range]);
  const hasRevenue = timeline.totalOrders > 0 || timeline.totalSales !== 0 || (compare && timeline.previousSales !== 0);
  const bucketLabel = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" }[timeline.granularity];

  return (
    <article className="dashboard-panel dashboard-revenue-panel">
      <div className="dashboard-revenue-header">
        <div>
          <h2><Link to={SUPER_ADMIN_ROUTES.SALES_GRAPH}>Revenue Monitoring Chart</Link></h2>
          <p>{bucketLabel} totals · {formatRange(range.startDate, range.endDate)}</p>
        </div>
        <DashboardRevenueFilter range={range} preset={selection.preset} asOfDate={asOfDate} onPreset={(preset) => setSelection({ preset })} onApply={(dates) => setSelection({ ...dates, preset: "custom" })} />
      </div>
      <div className="dashboard-revenue-summary">
        <div><strong>{isUnavailable ? "—" : formatPeso(timeline.totalSales)}</strong><p></p></div>
        <div className="dashboard-revenue-comparison">
          <label><input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} />Compare previous period</label>
          {compare && <p>{formatRange(timeline.previousStartDate, timeline.previousEndDate)}</p>}
        </div>
      </div>
      <div className="dashboard-chart-legend" aria-label="Revenue chart legend">
        <span><i style={{ background: "#eb6269" }} aria-hidden="true" />Selected period</span>
        {compare && <span><i style={{ background: "#319fca" }} aria-hidden="true" />Previous period · {isUnavailable ? "—" : formatPeso(timeline.previousSales)}</span>}
      </div>
      <div className="dashboard-revenue-chart">
        {isUnavailable ? <p className="dashboard-chart-message">Revenue data is unavailable.</p>
          : !hasRevenue ? <p className="dashboard-chart-message">No completed sales in the selected period. Choose another date range.</p>
            : <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline.data} margin={{ top: 8, right: 14, left: 0, bottom: 0 }} accessibilityLayer>
                <CartesianGrid stroke="#eee9e3" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6f6258" }} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis tickFormatter={compactPeso} tick={{ fontSize: 10, fill: "#6f6258" }} tickLine={false} axisLine={false} width={54} domain={[0, (maximum) => Math.max(1, maximum)]} />
                <Tooltip content={<RevenueTooltip compare={compare} />} />
                {compare && <Line type="linear" dataKey="previousSales" name="Previous period" stroke="#319fca" strokeDasharray="5 4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />}
                <Line type="linear" dataKey="totalSales" name="Selected period" stroke="#eb6269" strokeWidth={2.5} dot={timeline.data.length === 1 ? { r: 4 } : false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>}
      </div>
    </article>
  );
}

export function CustomerMapCard({ activity, asOfDate, isUnavailable }) {
  const [period, setPeriod] = useState("weekly");
  const data = useMemo(() => buildCustomerActivity(activity, period, asOfDate), [activity, period, asOfDate]);
  const total = data.reduce((sum, row) => sum + row.count, 0);

  return (
    <article className="dashboard-panel dashboard-customer-map-panel">
      <div className="dashboard-insight-header">
        <div><h2>Customer Map</h2><p>Orders per day · {period === "weekly" ? "last 7 days" : "this month"}</p></div>
        <select aria-label="Customer map period" value={period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <div className="dashboard-customer-chart" role="img" aria-label={isUnavailable ? "Customer activity unavailable" : `${total} non-cancelled orders, ${period === "weekly" ? "last 7 days" : "this month"}. ${data.map((row) => `${row.date}: ${row.count}`).join("; ")}`}>
        {isUnavailable ? <p className="dashboard-chart-message">Customer activity is unavailable.</p>
          : <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} accessibilityLayer>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6f6258" }} tickLine={false} axisLine={false} minTickGap={8} height={24} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#6f6258" }} tickLine={false} axisLine={false} width={40} domain={[0, (maximum) => Math.max(1, maximum)]} tickCount={5} />
              <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload.date ?? ""} formatter={(value) => [Number(value).toLocaleString("en-PH"), "Orders"]} contentStyle={{ borderRadius: 10, borderColor: "#ebe3da", fontSize: 11 }} cursor={{ fill: "#faf6f0" }} />
              <Bar dataKey="count" maxBarSize={24} radius={[2, 2, 0, 0]}>
                {data.map((row, index) => <Cell key={row.date} fill={index % 2 === 0 ? "#eb6269" : "#e5bb32"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>}
      </div>
      {!isUnavailable && total === 0 && <p className="dashboard-customer-empty">No orders in this period</p>}
    </article>
  );
}
