import { INVENTORY_VIEWS } from "../constants/inventory.js";

export function isNavigationLinkActive(link, location) {
  if (link.children) {
    return link.children.some((child) => isNavigationLinkActive(child, location))
      || (link.relatedPaths ?? []).includes(location.pathname);
  }

  if (link.view) {
    if (location.pathname !== link.path) return false;
    const requestedView = new URLSearchParams(location.search).get("view");
    const activeView = requestedView === INVENTORY_VIEWS.MENU_ITEMS
      ? INVENTORY_VIEWS.MENU_ITEMS
      : INVENTORY_VIEWS.INGREDIENTS;
    return link.view === activeView;
  }

  return location.pathname === link.path || location.pathname.startsWith(`${link.path}/`);
}

export function getNavigationLinkTarget(link, location) {
  if (!link.view) return link.path;

  // Switching inventory views keeps filters such as the low-stock status.
  const params = new URLSearchParams(location.pathname === link.path ? location.search : "");
  params.set("view", link.view);
  return `${link.path}?${params.toString()}`;
}

export function getCurrentNavigationLabel(navLinks, location) {
  const pageLinks = navLinks.flatMap((link) => link.children || [link]);
  return pageLinks.find((link) => isNavigationLinkActive(link, location))?.label;
}
