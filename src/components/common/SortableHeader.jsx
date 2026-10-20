import "../../styles/sortControls.css";

/** Small ↑↓ control placed beside the table column it sorts. */
function SortableHeader({ label, column, sortBy, direction, onSort }) {
  const active = sortBy === column;
  const currentDirection = active ? direction : null;
  const nextDirection = active
    ? direction === "asc" ? "descending" : "ascending"
    : column === "date" ? "descending" : "ascending";

  return (
    <th scope="col" aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <span className="dayo-sortable-heading">
        <span>{label}</span>
        <button
          className="dayo-column-sort-button"
          type="button"
          onClick={() => onSort(column)}
          aria-label={`Sort ${label} ${nextDirection}`}
          title={`Sort ${label} ${nextDirection}`}
        >
          <svg viewBox="0 0 16 22" width="15" height="20" fill="none" aria-hidden="true">
            <path
              className={active && currentDirection === "asc" ? "is-active" : ""}
              d="m4 9 4-4 4 4"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            />
            <path
              className={active && currentDirection === "desc" ? "is-active" : ""}
              d="m4 13 4 4 4-4"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </button>
      </span>
    </th>
  );
}

export default SortableHeader;
