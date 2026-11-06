import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { AUTH_ROUTES, CUSTOMER_ROUTES } from "../../constants/routes";
import { clearAuthUser } from "../../utils/authUtils";
import { getCurrentNavigationLabel } from "../../utils/adminNavigationUtils";
import { getStoredAuthUser } from "../../utils/authUtils";
import { supabase } from "../../lib/supabase";
import { AdminShellContext } from "./AdminShellContext";
import AdminSidebarNavigation from "./AdminSidebarNavigation";
import RestockNotifications from "./RestockNotifications";

function AdminShell({ roleName, navLinks, pageTitle, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [headerActionsTarget, setHeaderActionsTarget] = useState(null);
  const currentUser = getStoredAuthUser();
  const displayRoleName = currentUser?.role === "ADMIN"
    ? currentUser.position || "Staff"
    : roleName === "Super Admin" ? "Admin" : roleName;
  const visibleNavLinks = currentUser?.role === "ADMIN"
    ? navLinks.filter((link) => currentUser.allowedRoutes?.includes(link.path))
    : navLinks;

  const currentPageName =
    pageTitle ||
    getCurrentNavigationLabel(visibleNavLinks, location) || displayRoleName;

  async function handleLogout() {
    try {
      if (supabase) await supabase.auth.signOut();
    } finally {
      clearAuthUser();
      navigate(AUTH_ROUTES.LOGIN, { replace: true });
    }
  }

  return (
    <AdminShellContext.Provider value={{ isSidebarOpen, headerActionsTarget }}>
      <div className={isSidebarOpen ? "admin-shell" : "admin-shell sidebar-closed"}>
        {currentUser?.role === "SUPER_ADMIN" && <RestockNotifications />}
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
            <div>
              <h1>DaYo</h1>
              <p>{displayRoleName}</p>
            </div>

            <button
              type="button"
              className="admin-sidebar-close-button"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close navigation sidebar"
              title="Close sidebar"
            >
              <span className="admin-sidebar-close-icon" aria-hidden="true" />
            </button>
          </div>


          <AdminSidebarNavigation navLinks={visibleNavLinks} roleName={roleName} />

          <div className="admin-sidebar-footer">
            <Link className="admin-sidebar-footer-link" to={CUSTOMER_ROUTES.MENU}>
              View Customer Menu
            </Link>

            <button
              type="button"
              className="admin-sidebar-logout-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </aside>

        <main className="admin-main-content">
          {!isSidebarOpen && (
            <div className="admin-collapsed-page-header">
              <div className="admin-collapsed-page-title">
                <button
                  type="button"
                  className="admin-sidebar-open-button"
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Open navigation sidebar"
                >
                  ☰ 
                </button>
                <h1>{currentPageName}</h1>
              </div>

              <div
                ref={setHeaderActionsTarget}
                className="admin-collapsed-page-actions"
                aria-label="Page actions"
              />
            </div>
          )}

          {children}
        </main>
      </div>
    </AdminShellContext.Provider>
  );
}

export default AdminShell;
