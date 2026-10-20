import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";

import { AUTH_ROUTES, CUSTOMER_ROUTES } from "../../constants/routes";
import { clearAuthUser } from "../../utils/authUtils";
import { supabase } from "../../lib/supabase";
import { AdminShellContext } from "./AdminShellContext";
import RestockNotifications from "./RestockNotifications";

function AdminShell({ roleName, navLinks, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [headerActionsTarget, setHeaderActionsTarget] = useState(null);

  const currentPageName =
    navLinks.find(
      (link) =>
        location.pathname === link.path ||
        location.pathname.startsWith(`${link.path}/`)
    )?.label || roleName;

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
        {roleName === "Super Admin" && <RestockNotifications />}
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
            <div>
              <h1>DaYo</h1>
              <p>{roleName}</p>
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


          <nav className="admin-sidebar-nav" aria-label={`${roleName} navigation`}>
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  isActive ? "admin-nav-link active" : "admin-nav-link"
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

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
