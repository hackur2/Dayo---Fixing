import {
  ADMIN_ROUTES,
  AUTH_ROUTES,
  CUSTOMER_ROUTES,
  SUPER_ADMIN_ROUTES,
} from "../constants/routes.js";

import { ROLE_HOME_ROUTES, USER_ROLES } from "../constants/userRoles.js";

function isAdminRoute(pathname = "") {
  return pathname.startsWith("/admin");
}

function isSuperAdminRoute(pathname = "") {
  return pathname.startsWith("/super-admin");
}

function isCustomerRoute(pathname = "") {
  return pathname.startsWith("/customer");
}

export function getRoleHomeRoute(role) {
  if (typeof role === "object" && role) {
    if (role.role === USER_ROLES.ADMIN) {
      return Array.isArray(role.allowedRoutes) && role.allowedRoutes.length
        ? role.allowedRoutes[0]
        : AUTH_ROUTES.LOGIN;
    }
    return getRoleHomeRoute(role.role);
  }
  return ROLE_HOME_ROUTES[role] || CUSTOMER_ROUTES.MENU;
}

export function isRouteAllowedForRole(role, pathname = "") {
  if (!pathname || pathname === "/") {
    return true;
  }

  if (isCustomerRoute(pathname)) {
    return true;
  }

  if (role === USER_ROLES.ADMIN) {
    return isAdminRoute(pathname);
  }

  if (role === USER_ROLES.SUPER_ADMIN) {
    return isSuperAdminRoute(pathname);
  }

  return false;
}

export function isRouteAllowedForUser(user, pathname = "") {
  if (!user) return false;
  if (user.role !== USER_ROLES.ADMIN) return isRouteAllowedForRole(user.role, pathname);
  return isAdminRoute(pathname) && Array.isArray(user.allowedRoutes) && user.allowedRoutes.includes(pathname);
}

export function getSafeRedirectPath(user, requestedPath) {
  if (requestedPath && isRouteAllowedForUser(user, requestedPath)) {
    return requestedPath;
  }

  return getRoleHomeRoute(user);
}

export const AUTH_ROUTE_GROUPS = {
  ADMIN: Object.values(ADMIN_ROUTES),
  SUPER_ADMIN: Object.values(SUPER_ADMIN_ROUTES),
  CUSTOMER: Object.values(CUSTOMER_ROUTES),
};
