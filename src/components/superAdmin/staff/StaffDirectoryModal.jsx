import { useMemo, useState } from "react";
import SortableHeader from "../../common/SortableHeader";
import { sortRecords } from "../../../utils/sortUtils";

function StaffDirectoryModal({ staffDirectory, onClose }) {
  const [sortBy, setSortBy] = useState("name");
  const [direction, setDirection] = useState("asc");

  function handleSortColumn(column) {
    setDirection((current) =>
      sortBy === column
        ? current === "asc" ? "desc" : "asc"
        : "asc"
    );
    setSortBy(column);
  }

  const sortedDirectory = useMemo(() => {
    const getters = {
      name: [(staff) => staff.staffName, "text"],
      position: [(staff) => staff.position, "text"],
      added: [(staff) => staff.dateAdded === "Not set" ? null : staff.dateAdded, "date"],
    };
    const [getter, type] = getters[sortBy];
    return sortRecords(staffDirectory, getter, direction, type);
  }, [staffDirectory, sortBy, direction]);
  return (
    <div className="staff-modal-backdrop">
      <section className="staff-directory-modal">
        <div className="staff-modal-header">
          <div>
            <p className="admin-eyebrow">Staff Records</p>
            <h2>Registered Staff</h2>
            <p>List of staff records managed by the Super Admin.</p>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>

        {staffDirectory.length > 0 ? (
          <div className="staff-directory-table-wrapper">
            <table className="staff-directory-table">
              <thead>
                <tr>
                  <SortableHeader label="Staff Name" column="name" sortBy={sortBy} direction={direction} onSort={handleSortColumn} />
                  <SortableHeader label="Position" column="position" sortBy={sortBy} direction={direction} onSort={handleSortColumn} />
                  <SortableHeader label="Date Added" column="added" sortBy={sortBy} direction={direction} onSort={handleSortColumn} />
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {sortedDirectory.map((staff) => (
                  <tr key={`${staff.staffName}-${staff.position}`}>
                    <td>
                      <strong>{staff.staffName}</strong>
                    </td>
                    <td>{staff.position}</td>
                    <td>{staff.dateAdded}</td>
                    <td>
                      <span className="staff-directory-status">
                        {staff.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <section className="admin-empty-state">
            <h2>No staff records found</h2>
            <p>Add staff first to show them in the staff directory.</p>
          </section>
        )}

        <div className="staff-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

export default StaffDirectoryModal;