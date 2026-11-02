import "../../styles/pagination.css";

export default function Pagination({ pagination, onPageChange, label, disabled = false }) {
  const { page, pageCount, total, start, end } = pagination;
  return (
    <nav className="table-pagination" aria-label={`${label} pagination`}>
      <p aria-live="polite">Showing <strong>{start}–{end}</strong> of <strong>{total}</strong></p>
      <div>
        <button type="button" disabled={disabled || page === 1} onClick={() => onPageChange(page - 1)} aria-label={`Previous ${label.toLowerCase()} page`}>‹ Previous</button>
        <span>Page <strong>{page}</strong> of <strong>{pageCount}</strong></span>
        <button type="button" disabled={disabled || page === pageCount} onClick={() => onPageChange(page + 1)} aria-label={`Next ${label.toLowerCase()} page`}>Next ›</button>
      </div>
    </nav>
  );
}
