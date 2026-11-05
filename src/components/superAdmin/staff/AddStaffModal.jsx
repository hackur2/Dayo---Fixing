function AddStaffModal({
  formData,
  positionOptions,
  accessOptions,
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

          <label>
            Login Email
            <input type="email" value={formData.email} onChange={(event) => onChange("email", event.target.value)} placeholder="staff@yourcompany.com" required />
          </label>

          <label>
            Temporary Password
            <input type="password" minLength="8" value={formData.password} onChange={(event) => onChange("password", event.target.value)} placeholder="At least 8 characters" autoComplete="new-password" required />
          </label>

          <fieldset className="staff-access-options">
            <legend>Allowed Pages</legend>
            <p>Choose only the pages this staff member can open.</p>
            {accessOptions.map((option) => (
              <label key={option.path}>
                <input type="checkbox" checked={formData.allowedRoutes.includes(option.path)} onChange={(event) => onChange("allowedRoutes", event.target.checked ? [...formData.allowedRoutes, option.path] : formData.allowedRoutes.filter((path) => path !== option.path))} />
                {option.label}
              </label>
            ))}
          </fieldset>

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
