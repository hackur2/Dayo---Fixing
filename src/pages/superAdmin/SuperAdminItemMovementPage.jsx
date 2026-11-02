import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AdminPageActions from "../../components/layout/AdminPageActions";
import Pagination from "../../components/common/Pagination";
import SortableHeader from "../../components/common/SortableHeader";
import SalesDateRangeHeader from "../../components/superAdmin/sales/SalesDateRangeHeader";
import { SUPER_ADMIN_ROUTES } from "../../constants/routes";
import { useSalesGraphData } from "../../hooks/useSalesGraphData";
import { useInventoryRefreshVersion } from "../../hooks/useInventoryRefreshVersion";
import { usePagination } from "../../hooks/usePagination";
import { buildItemMovement } from "../../utils/salesReportUtils";
import { sortRecords } from "../../utils/sortUtils";
import "../../styles/superAdminInventory.css";
import "../../styles/superAdminSalesGraph.css";
import "../../styles/itemMovement.css";

const percent = (value) => `${value.toLocaleString("en-PH", { maximumFractionDigits: 2 })}%`;
const MOVEMENT_ORDER = { fast: 0, slow: 1, non: 2 };

function MovementTooltip({ active, payload }) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  return <div className="sales-graph-tooltip">
    <strong>{item.name}</strong><p>{item.quantitySold.toLocaleString("en-PH")} units sold</p>
    <p>{percent(item.popularity)} popularity · {item.classification}</p>
    <p>{item.categoryName} · {percent(item.threshold)} threshold</p>
  </div>;
}

export default function SuperAdminItemMovementPage() {
  const [range, setRange] = useState({ startDate: "", endDate: "" });
  const [categoryId, setCategoryId] = useState("");
  const [sortBy, setSortBy] = useState("popularity");
  const [sortDirection, setSortDirection] = useState("desc");
  const [version, setVersion] = useState(0);
  const inventoryVersion = useInventoryRefreshVersion();
  const { salesReport, isSalesGraphLoading: isLoading, salesGraphError: error } = useSalesGraphData(range.startDate, range.endDate, undefined, `${version}:${inventoryVersion}`);
  const movement = useMemo(() => buildItemMovement(salesReport.movementItems ?? []), [salesReport.movementItems]);
  const selectedCategory = movement.categories.find((category) => category.id === categoryId);
  const activeCategoryId = selectedCategory?.id ?? "";
  const rows = useMemo(() => movement.items.filter((item) => !activeCategoryId || item.categoryId === activeCategoryId), [movement.items, activeCategoryId]);
  const sortedRows = useMemo(() => sortRecords(rows,
    sortBy === "popularity" ? (item) => item.popularity : (item) => MOVEMENT_ORDER[item.movement],
    sortDirection, "number"), [rows, sortBy, sortDirection]);
  const pagination = usePagination(sortedRows, [activeCategoryId, range.startDate, range.endDate, sortBy, sortDirection]);
  const reload = () => setVersion((current) => current + 1);
  const sortColumn = (column) => {
    setSortDirection(sortBy === column && sortDirection === "asc" ? "desc" : "asc");
    setSortBy(column);
  };

  return <section className="admin-page item-movement-page" aria-busy={isLoading}>
    <div className="admin-page-heading">
      <div><h1>Fast Moving, Slow Moving Items</h1></div>
      <AdminPageActions className="movement-page-actions">
        <Link className="secondary-button" to={SUPER_ADMIN_ROUTES.INVENTORY}>Back to Inventory</Link>
        <button type="button" className="secondary-button" onClick={reload} disabled={isLoading}>Refresh</button>
      </AdminPageActions>
    </div>
    {error && <div className="inventory-message danger movement-page-error" role="alert"><p>{error}</p><button type="button" className="secondary-button" onClick={reload}>Retry</button></div>}
    <section className="sales-graph-card movement-detail-chart" aria-labelledby="movement-chart-title">
      <SalesDateRangeHeader title="Menu Item Sales" titleId="movement-chart-title" description="Units sold · Completed orders" range={range} onApply={setRange} controls={
        <select className="sales-trend-entity-select" aria-label="Item movement category" value={activeCategoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={isLoading || Boolean(error)}>
          <option value="">All categories</option>
          {movement.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      } />
      
      {isLoading ? <div className="movement-chart-empty" role="status">Loading item movement...</div>
        : error ? <div className="movement-chart-empty">Use Retry to load the chart.</div>
          : rows.length === 0 ? <div className="movement-chart-empty">No active menu items available.</div>
            : <div className="movement-chart-scroll" role="region" aria-label="Menu item sales chart" tabIndex={0}>
              <div className="movement-chart" style={{ height: Math.max(260, rows.length * 46 + 40) }} role="img" aria-label={rows.map((item) => `${item.name}: ${item.quantitySold} units sold, ${item.classification}`).join("; ")}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows} layout="vertical" margin={{ top: 12, right: 48, left: 8, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} domain={[0, (maximum) => Math.max(1, maximum)]} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(name) => name.length > 21 ? `${name.slice(0, 20)}…` : name} />
                    <Tooltip content={<MovementTooltip />} cursor={{ fill: "#f4f7fb" }} />
                    <Bar dataKey="quantitySold" name="Units sold" fill="#25578f" barSize={30} radius={[0, 7, 7, 0]} isAnimationActive={false}>
                      <LabelList dataKey="quantitySold" position="right" style={{ fontSize: 12, fill: "#536477" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>}
    </section>
    <section className="inventory-table-card movement-table-card" aria-labelledby="movement-list-title">
      <div className="inventory-table-header"><div><h2 id="movement-list-title">Menu Item Movement</h2><p>{isLoading || error ? "" : `${rows.length} menu item${rows.length === 1 ? "" : "s"}`}</p></div></div>
      <div className="inventory-table-scroll" role="region" aria-labelledby="movement-list-title" tabIndex={0}>
        <table className="inventory-table movement-table">
          <thead><tr>
            <th scope="col">Menu Item</th>
            <SortableHeader label="Popularity" column="popularity" sortBy={sortBy} direction={sortDirection} onSort={sortColumn} />
            <SortableHeader label="Classification" column="classification" sortBy={sortBy} direction={sortDirection} onSort={sortColumn} />
          </tr></thead>
          <tbody>
            {!isLoading && !error && pagination.rows.map((item) => <tr key={item.id}>
              <td><strong>{item.name}</strong><small>{item.categoryName}</small></td>
              <td>{percent(item.popularity)}</td>
              <td><span className={`movement-classification ${item.movement}`}>{item.classification}</span></td>
            </tr>)}
            {(isLoading || error || rows.length === 0) && <tr><td colSpan={3} className="movement-table-empty" role="status">{isLoading ? "Loading menu items..." : error ? "Use Retry to load the list." : "No active menu items available."}</td></tr>}
          </tbody>
        </table>
      </div>
      {!error && <Pagination pagination={pagination} label="Item Movement" disabled={isLoading} onPageChange={pagination.setPage} />}
    </section>
    
  </section>;
}
