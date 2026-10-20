function AlertMessage({ type = "info", title, message, children }) {
  return (
    <div className={`alert-message ${type}`} role="alert">
      {title && <strong>{title}</strong>}
      {message && <p>{message}</p>}
      {children}
    </div>
  );
}

export default AlertMessage;