function EmptyState({
  title = "No data found",
  message = "There is nothing to display yet.",
  children,
}) {
  return (
    <div className="state-card empty-state">
      <strong>{title}</strong>
      <p>{message}</p>

      {children && <div className="empty-state-actions">{children}</div>}
    </div>
  );
}

export default EmptyState;