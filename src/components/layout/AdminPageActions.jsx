import { useContext } from "react";
import { createPortal } from "react-dom";
import { AdminShellContext } from "./AdminShellContext";

// Keep each page's existing action buttons in one place.
// When the sidebar closes, move them into the shared collapsed header.
function AdminPageActions({ className = "", children }) {
  const { isSidebarOpen, headerActionsTarget } = useContext(AdminShellContext);

  const actions = <div className={className}>{children}</div>;

  if (!isSidebarOpen) {
    return headerActionsTarget
      ? createPortal(actions, headerActionsTarget)
      : null;
  }

  return actions;
}

export default AdminPageActions;
