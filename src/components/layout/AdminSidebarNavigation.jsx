import { useId, useState } from "react";
import { Link, useLocation } from "react-router";

import { getNavigationLinkTarget, isNavigationLinkActive } from "../../utils/adminNavigationUtils";

function SidebarLink({ link, location, isSubLink = false }) {
  const isActive = isNavigationLinkActive(link, location);

  return (
    <Link
      to={getNavigationLinkTarget(link, location)}
      replace={Boolean(link.view) && location.pathname === link.path}
      className={`admin-nav-link${isSubLink ? " admin-nav-sub-link" : ""}${isActive ? " active" : ""}`}
      aria-current={isActive ? "page" : undefined}
    >
      {link.label}
    </Link>
  );
}

function SidebarGroup({ link, location }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const groupId = useId();
  const isActive = isNavigationLinkActive(link, location);

  return (
    <div className="admin-nav-group">
      <div className={`admin-nav-group-header${isActive ? " has-active-child" : ""}`}>
        <Link className="admin-nav-link" to={link.path}>{link.label}</Link>
        <button
          type="button"
          className="admin-nav-group-toggle"
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${link.label} navigation`}
          aria-expanded={isExpanded}
          aria-controls={groupId}
          onClick={() => setIsExpanded((expanded) => !expanded)}
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div id={groupId} className="admin-nav-group-children" hidden={!isExpanded}>
        {link.children.map((child) => (
          <SidebarLink key={`${child.path}:${child.view || ""}`} link={child} location={location} isSubLink />
        ))}
      </div>
    </div>
  );
}

function AdminSidebarNavigation({ navLinks, roleName }) {
  const location = useLocation();

  return (
    <nav className="admin-sidebar-nav" aria-label={`${roleName} navigation`}>
      {navLinks.map((link) => link.children ? (
        <SidebarGroup key={link.path} link={link} location={location} />
      ) : (
        <SidebarLink key={link.path} link={link} location={location} />
      ))}
    </nav>
  );
}

export default AdminSidebarNavigation;
