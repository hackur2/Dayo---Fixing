function StaffFilters({
  searchTerm,
  positionFilter,
  statusFilter,
  dateFilter,
  positionOptions,
  statusOptions,
  onSearchChange,
  onPositionChange,
  onStatusChange,
  onDateChange,
}) {
  return (
    <section className="staff-toolbar">
      <input
        type="search"
        value={searchTerm}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search staff name"
        aria-label="Search staff name"
      />

      <select
        value={positionFilter}
        onChange={(event) => onPositionChange(event.target.value)}
        aria-label="Filter by position"
      >
        {positionOptions.map((position) => (
          <option key={position} value={position}>
            {position}
          </option>
        ))}
      </select>

      <select
        value={statusFilter}
        onChange={(event) => onStatusChange(event.target.value)}
        aria-label="Filter by shift status"
      >
        {statusOptions.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={dateFilter}
        onChange={(event) => onDateChange(event.target.value)}
        aria-label="Filter by shift date"
      />
    </section>
  );
}

export default StaffFilters;