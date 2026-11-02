import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_NAV_LINKS, SUPER_ADMIN_NAV_LINKS } from "../src/constants/navigation.js";
import { SUPER_ADMIN_ROUTES } from "../src/constants/routes.js";
import {
  getCurrentNavigationLabel,
  getNavigationLinkTarget,
  isNavigationLinkActive,
} from "../src/utils/adminNavigationUtils.js";

const inventory = SUPER_ADMIN_NAV_LINKS.find((link) => link.label === "Inventory");
const [ingredients, menuItems, supplier] = inventory.children;
const archive = SUPER_ADMIN_NAV_LINKS.find((link) => link.label === "Archive");
const location = (pathname, search = "") => ({ pathname, search });

test("inventory defaults to Ingredients and only highlights the selected view", () => {
  for (const search of ["", "?view=ingredients", "?view=unknown"]) {
    const current = location(inventory.path, search);
    assert.equal(isNavigationLinkActive(ingredients, current), true);
    assert.equal(isNavigationLinkActive(menuItems, current), false);
    assert.equal(getCurrentNavigationLabel(SUPER_ADMIN_NAV_LINKS, current), "Ingredients");
  }
  const current = location(inventory.path, "?view=menuItems");
  assert.equal(isNavigationLinkActive(ingredients, current), false);
  assert.equal(isNavigationLinkActive(menuItems, current), true);
  assert.equal(getCurrentNavigationLabel(SUPER_ADMIN_NAV_LINKS, current), "Menu Items");
});

test("Archive is independent of Inventory and sits before Order Summary", () => {
  const current = location(archive.path, "?view=ingredients");
  assert.equal(isNavigationLinkActive(archive, current), true);
  assert.equal(isNavigationLinkActive(inventory, current), false);
  assert.equal(isNavigationLinkActive(ingredients, current), false);
  assert.equal(isNavigationLinkActive(menuItems, current), false);
  assert.equal(getCurrentNavigationLabel(SUPER_ADMIN_NAV_LINKS, current), "Archive");
  const index = SUPER_ADMIN_NAV_LINKS.indexOf(archive);
  assert.equal(SUPER_ADMIN_NAV_LINKS[index - 1], inventory);
  assert.equal(SUPER_ADMIN_NAV_LINKS[index + 1].label, "Order Summary");
});

test("view switching preserves inventory filters without bringing unrelated page queries", () => {
  const target = getNavigationLinkTarget(menuItems, location(inventory.path, "?status=Low+Stock&view=ingredients"));
  const params = new URLSearchParams(target.split("?")[1]);
  assert.equal(params.get("status"), "Low Stock");
  assert.equal(params.get("view"), "menuItems");
  assert.equal(getNavigationLinkTarget(ingredients, location(archive.path, "?search=Rice")), `${inventory.path}?view=ingredients`);
});

test("Supplier remains at its existing route within the Inventory group", () => {
  const current = location(SUPER_ADMIN_ROUTES.SUPPLIER);
  assert.equal(getNavigationLinkTarget(supplier, current), SUPER_ADMIN_ROUTES.SUPPLIER);
  assert.equal(isNavigationLinkActive(inventory, current), true);
  assert.equal(isNavigationLinkActive(ingredients, current), false);
  assert.equal(getCurrentNavigationLabel(SUPER_ADMIN_NAV_LINKS, current), "Supplier");
});

test("Shelf Life belongs to Inventory and does not highlight Dashboard or Ingredients", () => {
  const shelfLife = inventory.children.find((link) => link.label === "Shelf Life");
  const current = location(SUPER_ADMIN_ROUTES.SHELF_LIFE);
  assert.equal(getNavigationLinkTarget(shelfLife, current), SUPER_ADMIN_ROUTES.SHELF_LIFE);
  assert.equal(isNavigationLinkActive(inventory, current), true);
  assert.equal(getCurrentNavigationLabel(SUPER_ADMIN_NAV_LINKS, current), "Shelf Life");
  const activePages = SUPER_ADMIN_NAV_LINKS.flatMap((link) => link.children || [link])
    .filter((link) => isNavigationLinkActive(link, current));
  assert.deepEqual(activePages.map((link) => link.label), ["Shelf Life"]);
});

test("Admin navigation retains its flat routes and active page labels", () => {
  for (const link of ADMIN_NAV_LINKS) {
    assert.equal(link.children, undefined);
    assert.equal(getNavigationLinkTarget(link, location(link.path)), link.path);
    assert.equal(getCurrentNavigationLabel(ADMIN_NAV_LINKS, location(link.path)), link.label);
  }
});

test("the excess details page keeps Inventory active without selecting a different inventory view", () => {
  const current = location(SUPER_ADMIN_ROUTES.POTENTIAL_EXCESS);
  assert.equal(isNavigationLinkActive(inventory, current), true);
  assert.equal(isNavigationLinkActive(ingredients, current), false);
  assert.equal(isNavigationLinkActive(menuItems, current), false);
  assert.equal(isNavigationLinkActive(archive, current), false);
});

test("item movement details belong to Inventory without selecting Ingredients or Menu Items", () => {
  const current = location(SUPER_ADMIN_ROUTES.ITEM_MOVEMENT);
  assert.equal(isNavigationLinkActive(inventory, current), true);
  assert.equal(isNavigationLinkActive(ingredients, current), false);
  assert.equal(isNavigationLinkActive(menuItems, current), false);
});
