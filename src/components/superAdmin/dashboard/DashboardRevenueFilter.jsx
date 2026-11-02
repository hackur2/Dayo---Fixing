import { useId, useRef, useState } from "react";

const PRESETS = [
  ["last7", "Last 7 days"], ["last30", "Last 30 days"], ["month", "This month"],
  ["year", "This year"], ["all", "All dates"],
];

export default function DashboardRevenueFilter({ range, preset, asOfDate, onPreset, onApply }) {
  const id = useId();
  const buttonRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(range);
  const [error, setError] = useState("");

  function close() {
    setIsOpen(false);
    buttonRef.current?.focus();
  }

  function toggle() {
    setDraft(range);
    setError("");
    setIsOpen((open) => !open);
  }

  function apply(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const next = { startDate: String(values.get("startDate") || ""), endDate: String(values.get("endDate") || "") };
    setDraft(next);
    if (!next.startDate || !next.endDate) setError("Select both a start date and an end date.");
    else if (next.startDate > next.endDate) setError("Start date must be on or before end date.");
    else if (next.endDate > asOfDate) setError("Select dates on or before today.");
    else {
      onApply(next);
      close();
    }
  }

  return (
    <div className="dashboard-revenue-controls">
      <select aria-label="Revenue period" value={preset} onChange={(event) => { onPreset(event.target.value); setIsOpen(false); }}>
        {PRESETS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        {preset === "custom" && <option value="custom">Custom dates</option>}
      </select>
      <button ref={buttonRef} type="button" className="dashboard-revenue-calendar" onClick={toggle} aria-label="Select Total Revenue date range" aria-haspopup="dialog" aria-expanded={isOpen} aria-controls={`${id}-filter`} title="Select date range">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2" /></svg>
      </button>
      {isOpen && <form id={`${id}-filter`} role="dialog" aria-labelledby={`${id}-title`} className="dashboard-revenue-date-filter" onSubmit={apply} noValidate onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }}>
        <h3 id={`${id}-title`}>Revenue date range</h3>
        <div className="dashboard-revenue-date-fields">
          <label htmlFor={`${id}-start`}>Start date
            <input autoFocus id={`${id}-start`} name="startDate" type="date" value={draft.startDate} max={draft.endDate || asOfDate} onChange={(event) => { setDraft((value) => ({ ...value, startDate: event.target.value })); setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
          </label>
          <label htmlFor={`${id}-end`}>End date
            <input id={`${id}-end`} name="endDate" type="date" value={draft.endDate} min={draft.startDate || undefined} max={asOfDate} onChange={(event) => { setDraft((value) => ({ ...value, endDate: event.target.value })); setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
          </label>
        </div>
        {error && <p className="dashboard-revenue-filter-error" id={`${id}-error`} role="alert">{error}</p>}
        <div className="dashboard-revenue-date-actions">
          <button type="button" onClick={() => { onPreset("last30"); close(); }}>Reset</button>
          <button type="button" onClick={close}>Cancel</button>
          <button type="submit">Apply</button>
        </div>
      </form>}
    </div>
  );
}
