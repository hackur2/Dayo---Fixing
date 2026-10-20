import { createContext } from "react";

// Shared management layout state for optional page-header actions.
export const AdminShellContext = createContext({
  isSidebarOpen: true,
  headerActionsTarget: null,
});
