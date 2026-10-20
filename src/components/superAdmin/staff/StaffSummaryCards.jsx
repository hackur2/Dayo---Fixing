function StaffSummaryCards({ summary }) {
  return (
    <section className="staff-summary-grid">
      <article className="staff-summary-card featured">
        <span>Total Staff</span>
        <strong>{summary.totalStaff}</strong>
        <p></p>
      </article>

      <article className="staff-summary-card">
        <span>On Duty</span>
        <strong>{summary.onDutyCount}</strong>
        <p></p>
      </article>

      <article className="staff-summary-card warning">
        <span>Late</span>
        <strong>{summary.lateCount}</strong>
        <p></p>
      </article>

      <article className="staff-summary-card danger">
        <span>Absent</span>
        <strong>{summary.absentCount}</strong>
        <p></p>
      </article>
    </section>
  );
}

export default StaffSummaryCards;