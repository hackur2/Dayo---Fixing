import { useId, useRef, useState } from "react";

function SalesDateRangeHeader({ title, titleId, description = "", range, onApply, controls }) {
  const id = useId();
  const buttonRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(range);
  const [error, setError] = useState("");
  const filterId = `sales-date-filter-${id}`;
  const errorId = `${filterId}-error`;
  const { startDate, endDate } = range;
  const label = startDate && endDate ? `${startDate} – ${endDate}`
    : startDate ? `From ${startDate}` : endDate ? `Through ${endDate}` : "All dates";

  function toggle() {
    setDraft(range);
    setError("");
    setIsOpen((open) => !open);
  }

  function apply(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const selected = { startDate: String(values.get("startDate") || ""), endDate: String(values.get("endDate") || "") };
    setDraft(selected);
    if (selected.startDate && selected.endDate && selected.startDate > selected.endDate) {
      setError("Start date must be on or before end date.");
      return;
    }
    onApply(selected);
    setIsOpen(false);
    buttonRef.current?.focus();
  }

  function clear() {
    const empty = { startDate: "", endDate: "" };
    setDraft(empty);
    setError("");
    onApply(empty);
    setIsOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <>
      <div className="sales-graph-card-header">
        <div><h2 id={titleId}>{title}</h2><p>{description ? `${description} · ${label}` : label}</p></div>
        <div className="sales-graph-header-actions">
          {controls}
          <button
            ref={buttonRef}
            type="button"
            className={`sales-graph-calendar-button${startDate || endDate ? " active" : ""}`}
            onClick={toggle}
            aria-label={`Select ${title} date range`}
            aria-expanded={isOpen}
            aria-controls={filterId}
            title="Select date range"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="3" />
              <path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2" />
            </svg>
          </button>
        </div>
      </div>
      {isOpen && (
        <form id={filterId} className="sales-graph-date-filter" aria-label={`${title} date range`} onSubmit={apply} noValidate onKeyDown={(event) => {
          if (event.key === "Escape") { setIsOpen(false); buttonRef.current?.focus(); }
        }}>
          <label className="sales-graph-date-field" htmlFor={`${id}-start`}>
            <span>Start Date</span>
            <input id={`${id}-start`} name="startDate" type="date" value={draft.startDate} max={draft.endDate || undefined} onChange={(event) => { setDraft((value) => ({ ...value, startDate: event.target.value })); setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />
          </label>
          <label className="sales-graph-date-field" htmlFor={`${id}-end`}>
            <span>End Date</span>
            <input id={`${id}-end`} name="endDate" type="date" value={draft.endDate} min={draft.startDate || undefined} onChange={(event) => { setDraft((value) => ({ ...value, endDate: event.target.value })); setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />
          </label>
          <div className="sales-graph-date-actions">
            <button type="button" className="secondary-button" onClick={clear}>Clear</button>
            <button type="submit" className="primary-button">Apply</button>
          </div>
          {error && <p className="sales-graph-date-error" id={errorId} role="alert">{error}</p>}
        </form>
      )}
    </>
  );
}

export default SalesDateRangeHeader;
