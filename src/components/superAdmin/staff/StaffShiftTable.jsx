import SortableHeader from "../../common/SortableHeader";

function getStatusClassName(status) {
  return String(status || "").toLowerCase().replaceAll(" ", "-");
}

function StaffShiftTable({ staffShifts, onEditStaff, onToggleDuty, updatingDutyId, sortBy, sortDirection, onSortColumn }) {
  return (
    <section className="staff-table-card">
      <div className="staff-table-header">
        <div>
          <h2>Shift Records</h2>
          <p>{staffShifts.length} result(s)</p>
        </div>
      </div>

      {staffShifts.length > 0 ? (
        <table className="staff-table">
          <thead>
            <tr>
              <SortableHeader label="Staff Name" column="name" sortBy={sortBy} direction={sortDirection} onSort={onSortColumn} />
              <SortableHeader label="Position" column="position" sortBy={sortBy} direction={sortDirection} onSort={onSortColumn} />
              <SortableHeader label="Shift Date" column="date" sortBy={sortBy} direction={sortDirection} onSort={onSortColumn} />
              <th>Scheduled Time</th>
              <th>Actual Time</th>
              <SortableHeader label="Status" column="status" sortBy={sortBy} direction={sortDirection} onSort={onSortColumn} />
              <SortableHeader label="Total Hours" column="hours" sortBy={sortBy} direction={sortDirection} onSort={onSortColumn} />
              <th>Notes</th>
              <th>Duty / Action</th>
            </tr>
          </thead>

          <tbody>
            {staffShifts.map((staff) => (
              <tr key={staff.id}>
                <td>
                  <strong>{staff.staffName}</strong>
                </td>

                <td>{staff.position || staff.role}</td>

                <td>{staff.shiftDate}</td>

                <td>
                  <div className="staff-time-range">
                    <span>{staff.scheduledTimeIn || "Not set"}</span>
                    <small>to</small>
                    <span>{staff.scheduledTimeOut || "Not set"}</span>
                  </div>
                </td>

                <td>
                  <div className="staff-time-range">
                    <span>{staff.actualTimeIn || "Not recorded"}</span>
                    <small>to</small>
                    <span>{staff.actualTimeOut || "Not recorded"}</span>
                  </div>
                </td>

                <td>
                  <span
                    className={`staff-status-badge ${getStatusClassName(
                      staff.status
                    )}`}
                  >
                    {staff.status}
                  </span>
                </td>

                <td>{Number(staff.totalHours || 0).toFixed(2)}</td>

                <td>{staff.notes || "No notes"}</td>

                <td className="staff-actions-cell">
                  <div className="staff-row-actions">
                  <button
                    type="button"
                    className="secondary-button staff-small-button"
                    disabled={updatingDutyId === staff.id}
                    onClick={() => onToggleDuty(staff)}
                  >
                    {updatingDutyId === staff.id
                      ? "Saving..."
                      : staff.status === "On Duty" ? "Set Off Duty" : "Set On Duty"}
                  </button>
                  <button
                    type="button"
                    className="secondary-button staff-small-button"
                    onClick={() => onEditStaff(staff)}
                  >
                    Edit
                  </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <section className="admin-empty-state">
          <h2>No staff shift records found</h2>
          <p>Try changing your search or filters.</p>
        </section>
      )}
    </section>
  );
}

export default StaffShiftTable;
