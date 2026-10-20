import {
  ADMIN_ROUTES,
  CUSTOMER_ROUTES,
  SUPER_ADMIN_ROUTES,
} from "../constants/routes";

import { ROLE_HOME_ROUTES, USER_ROLES } from "../constants/userRoles";

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

export function getSafeRedirectPath(role, requestedPath) {
  if (requestedPath && isRouteAllowedForRole(role, requestedPath)) {
    return requestedPath;
  }

  return getRoleHomeRoute(role);
}

export const AUTH_ROUTE_GROUPS = {
  ADMIN: Object.values(ADMIN_ROUTES),
  SUPER_ADMIN: Object.values(SUPER_ADMIN_ROUTES),
  CUSTOMER: Object.values(CUSTOMER_ROUTES),
};
