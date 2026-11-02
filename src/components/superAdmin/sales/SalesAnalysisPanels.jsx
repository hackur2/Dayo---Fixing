import { useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useSalesGraphData } from "../../../hooks/useSalesGraphData";
import SalesDateRangeHeader from "./SalesDateRangeHeader";
import "../../../styles/superAdminSalesAnalysis.css";

const COLORS = ["#a52a2a", "#d2aa3d", "#819174", "#597f96", "#a67ba4", "#b88058", "#68645f", "#528c88", "#c06b70", "#7f759d"];
const GROUPS = { categories: "Categories", items: "Menu Items", ingredients: "Ingredients" };
const formatPeso = (value) => `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPercent = (value, total) => `${(total > 0 ? value / total * 100 : 0).toLocaleString("en-PH", { maximumFractionDigits: 1 })}%`;

export default function SalesAnalysisPanels({ loadReport }) {
  const [range, setRange] = useState({ startDate: "", endDate: "" });
  const [group, setGroup] = useState("categories");
  const [selection, setSelection] = useState({});
  const [search, setSearch] = useState("");
  const pickerRef = useRef(null);
  useEffect(() => {
    function closePicker(event) {
      const picker = pickerRef.current;
      if (!picker?.open) return;
      if (event.type === "keydown" && event.key === "Escape") {
        picker.open = false;
        picker.querySelector("summary")?.focus();
      } else if (event.type === "pointerdown" && !picker.contains(event.target)) {
        picker.open = false;
      }
    }
    document.addEventListener("pointerdown", closePicker);
    document.addEventListener("keydown", closePicker);
    return () => {
      document.removeEventListener("pointerdown", closePicker);
      document.removeEventListener("keydown", closePicker);
    };
  }, []);
  const { salesReport: report, isSalesGraphLoading: isLoading, salesGraphError: error } = useSalesGraphData(range.startDate, range.endDate, loadReport);
  const entries = useMemo(() => {
    const rows = report[group] ?? [];
    const all = group === "items" ? [...rows, ...(report.movementItems ?? []).filter((item) => !rows.some((row) => row.id === item.id))] : rows;
    return all.map((row, index) => ({ ...row, color: COLORS[index % COLORS.length] }));
  }, [report, group]);
  const selectedIds = selection[group] ?? entries.slice(0, 5).map((row) => row.id);
  const selected = entries.filter((row) => selectedIds.includes(row.id));
  const visible = entries.filter((row) => row.name.toLowerCase().includes(search.trim().toLowerCase()));
  const pie = selected.filter((row) => row.revenue > 0);
  const total = selected.reduce((sum, row) => sum + row.revenue, 0);
  const choose = (ids) => setSelection((current) => ({ ...current, [group]: ids }));
  const toggle = (id) => choose(selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id]);

  return <div className="sales-analysis-panels">
    <section className="sales-graph-card sales-revenue-card" aria-labelledby="revenue-breakdown-title" aria-busy={isLoading}>
      <SalesDateRangeHeader title="Revenue Breakdown" titleId="revenue-breakdown-title" range={range} onApply={setRange} />
      {error && <p className="sales-graph-message warning sales-analysis-error" role="alert">{error}</p>}
      <div className="sales-revenue-layout">
        <div className="sales-revenue-controls">
          <div className="sales-breakdown-pickers">
            <label>Group by<select aria-label="Revenue breakdown group" value={group} onChange={(event) => { setGroup(event.target.value); setSearch(""); }}>
              {Object.entries(GROUPS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <div className="sales-entry-control">
              <span>Choose {GROUPS[group].toLowerCase()}</span>
              <details ref={pickerRef} className="sales-entry-picker" key={group}>
                <summary aria-label={`Choose ${GROUPS[group].toLowerCase()}: ${selected.length} selected`}>{selected.length} selected</summary>
                <div className="sales-entry-picker-panel">
                  <input type="search" aria-label={`Search revenue ${GROUPS[group].toLowerCase()}`} placeholder={`Search ${GROUPS[group].toLowerCase()}`} value={search} onChange={(event) => setSearch(event.target.value)} />
                  <div className="sales-entry-picker-actions"><button type="button" onClick={() => choose(entries.map((row) => row.id))} disabled={isLoading || Boolean(error)}>Select all</button><button type="button" onClick={() => choose([])} disabled={isLoading || Boolean(error)}>Clear</button></div>
                  <div className="sales-entry-choices" role="group" aria-label={`Choose revenue ${GROUPS[group].toLowerCase()}`}>
                    {visible.map((row) => <label key={row.id}><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggle(row.id)} disabled={isLoading || Boolean(error)} /><span>{row.name}</span></label>)}
                    {!visible.length && <p className="sales-analysis-note">No matching entries.</p>}
                  </div>
                </div>
              </details>
            </div>
          </div>
          <ul className="sales-revenue-categories" aria-label={`Selected revenue ${GROUPS[group].toLowerCase()}`}>
            {selected.map((row) => <li key={row.id} className="sales-revenue-category">
              <i className="sales-category-dot" style={{ background: row.color }} aria-hidden="true" />
              <div><span>{row.name}</span><strong>{isLoading || error ? "—" : formatPeso(row.revenue)}</strong></div>
              <b className="sales-category-share">{formatPercent(row.revenue, total)}</b>
            </li>)}
          </ul>
          {!isLoading && !error && !selected.length && <p className="sales-analysis-note">Choose individual entries from the dropdown to build your chart.</p>}
          {group === "ingredients" && <p className="sales-analysis-note sales-allocation-note">Estimated allocation using current recipes and unit costs. Sales without complete recipe costs are Unallocated.</p>}
        </div>
        <div className="sales-revenue-visual">
          {isLoading ? <p className="sales-analysis-note" role="status">Loading revenue breakdown...</p> : error ? <p className="sales-analysis-note">Revenue data is unavailable.</p> : pie.length ? <>
            <div className="sales-revenue-pie" role="img" aria-label={`${GROUPS[group]} revenue breakdown: ${pie.map((row) => `${row.name} ${formatPercent(row.revenue, total)}`).join("; ")}`}>
              <ResponsiveContainer width="100%" height="100%"><PieChart>
                <Pie data={pie} dataKey="revenue" nameKey="name" outerRadius="82%" stroke="#ffffff" strokeWidth={3} isAnimationActive={false}>
                  {pie.map((row) => <Cell key={row.id} fill={row.color} />)}
                </Pie><Tooltip formatter={(value, name) => [`${formatPeso(value)} · ${formatPercent(Number(value), total)}`, name]} />
              </PieChart></ResponsiveContainer>
            </div>
            <div className="sales-revenue-total"><strong>{formatPeso(total)}</strong><span>{group === "ingredients" ? "Selected estimated revenue" : "Selected revenue"}</span></div>
          </> : <p className="sales-analysis-note">{selected.length ? "No completed sales for these entries in this period." : "Select entries to view the chart."}</p>}
        </div>
      </div>
    </section>
  </div>;
}
