function AddStaffModal({
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
            <h2>Add Staff</h2>
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
              placeholder="Enter full name"
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

          <div className="staff-modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>

            <button type="submit" className="primary-button">
              Save Staff
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default AddStaffModal;
