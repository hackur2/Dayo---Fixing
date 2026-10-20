function EditStaffModal({
  formData,
  positionOptions,
  onChange,
  onClose,
  onSubmit,
}) {
  return (
    <div className="staff-modal-backdrop">
      <section className="staff-modal">
        <div className="staff-modal-header">
          <div>
            <p className="admin-eyebrow">Staff Management</p>
            <h2>Edit Staff</h2>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="staff-modal-form" onSubmit={onSubmit}>
          <label>
            Staff Name
            <input
              type="text"
              value={formData.staffName}
              onChange={(event) => onChange("staffName", event.target.value)}
            />
          </label>

          <label>
            Position
            <select
              value={formData.position}
              onChange={(event) => onChange("position", event.target.value)}
            >
              {positionOptions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </label>

          <div className="staff-modal-two-column">
            <label>
              Scheduled Time In
              <input
                type="text"
                value={formData.scheduledTimeIn}
                onChange={(event) =>
                  onChange("scheduledTimeIn", event.target.value)
                }
                placeholder="08:00 AM"
              />
            </label>

            <label>
              Scheduled Time Out
              <input
                type="text"
                value={formData.scheduledTimeOut}
                onChange={(event) =>
                  onChange("scheduledTimeOut", event.target.value)
                }
                placeholder="04:00 PM"
              />
            </label>
          </div>

          <label>
            Notes
            <textarea
              value={formData.notes}
              onChange={(event) => onChange("notes", event.target.value)}
              rows="4"
              placeholder="Add staff notes"
            />
          </label>

          <div className="staff-modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>

            <button type="submit" className="primary-button">
              Save Changes
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default EditStaffModal;