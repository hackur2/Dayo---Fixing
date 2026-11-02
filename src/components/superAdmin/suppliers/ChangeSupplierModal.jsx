import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DETAIL_FIELDS = [
  { name: "name", label: "Supplier Name", placeholder: "Enter supplier name" },
  { name: "mobile", label: "Mobile Number", placeholder: "e.g. 0917 123 4567", type: "tel" },
  { name: "address", label: "Address", placeholder: "Enter complete address" },
];

function supplierDetails(supplier) {
  return Object.fromEntries(DETAIL_FIELDS.map(({ name }) => [name, supplier?.[name] || ""]));
}

function ChangeSupplierModal({ ingredient, onSave, onClose }) {
  const dialogRef = useRef(null);
  const [selectedId, setSelectedId] = useState(ingredient.suppliers[0]?.id ?? null);
  const [formData, setFormData] = useState(() => supplierDetails(ingredient.suppliers[0]));
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    dialog.querySelector('[name="name"]').focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  function selectSupplier(event) {
    const supplier = ingredient.suppliers.find((item) => String(item.id) === event.target.value);
    setSelectedId(supplier?.id ?? null);
    setFormData(supplierDetails(supplier));
    setErrors({});
    setSaveError("");
  }

  function changeDetails(event) {
    const { name, value } = event.target;
    setFormData((values) => ({ ...values, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    if (isSaving) return;
    const values = Object.fromEntries(DETAIL_FIELDS.map(({ name }) => [name, formData[name].trim()]));
    const nextErrors = {};
    for (const { name, label } of DETAIL_FIELDS) {
      if (!values[name]) nextErrors[name] = `${label} is required.`;
    }
    if (values.mobile && !/^(?:09\d{9}|\+639\d{9})$/.test(values.mobile.replace(/[\s()-]/g, ""))) {
      nextErrors.mobile = "Enter a Philippine mobile number, e.g. 0917 123 4567.";
    }
    setErrors(nextErrors);
    setSaveError("");
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      event.currentTarget.elements.namedItem(firstInvalid).focus();
      return;
    }
    setIsSaving(true);
    try {
      await onSave(selectedId, values);
    } catch (error) {
      setSaveError(error.message || "Unable to save the supplier details. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className="supplier-modal"
      aria-labelledby="change-supplier-title"
      aria-describedby="change-supplier-help"
      onCancel={(event) => { event.preventDefault(); if (!isSaving) onClose(); }}
    >
      <div className="supplier-modal-header">
        <div>
          <h2 id="change-supplier-title">Change Supplier</h2>
          <p id="change-supplier-help">Enter supplier details for {ingredient.name}.</p>
        </div>
        <button type="button" className="supplier-modal-close" onClick={onClose} disabled={isSaving} aria-label="Close supplier details">×</button>
      </div>
      <form className="supplier-modal-form" onSubmit={submit} noValidate aria-busy={isSaving}>
        <div className="supplier-id-preview">Ingredient: <strong>{ingredient.name}</strong></div>
        {ingredient.suppliers.length > 1 && (
          <label htmlFor="change-supplier-selection">
            Supplier to change
            <select id="change-supplier-selection" value={selectedId ?? ""} onChange={selectSupplier} disabled={isSaving}>
              {ingredient.suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.displayId} · {supplier.name}</option>
              ))}
            </select>
          </label>
        )}
        {saveError && <p className="supplier-save-error" role="alert">{saveError}</p>}
        {DETAIL_FIELDS.map(({ name, label, placeholder, type }) => (
          <div className="supplier-modal-field" key={name}>
            <label htmlFor={`change-supplier-${name}`}>
              <span>{label} <span aria-hidden="true">*</span></span>
              {name === "address" ? (
                <textarea id={`change-supplier-${name}`} name={name} value={formData[name]} onChange={changeDetails} placeholder={placeholder} rows={3} required disabled={isSaving} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `change-supplier-${name}-error` : undefined} />
              ) : (
                <input id={`change-supplier-${name}`} name={name} type={type || "text"} value={formData[name]} onChange={changeDetails} placeholder={placeholder} required disabled={isSaving} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `change-supplier-${name}-error` : undefined} />
              )}
            </label>
            {errors[name] && <small className="supplier-field-error" id={`change-supplier-${name}-error`} role="alert">{errors[name]}</small>}
          </div>
        ))}
        <div className="supplier-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? "Saving..." : "Save Supplier"}</button>
        </div>
      </form>
    </dialog>,
    document.body
  );
}

export default ChangeSupplierModal;
