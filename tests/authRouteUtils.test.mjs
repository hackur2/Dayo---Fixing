import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_ROUTES } from "../src/constants/routes.js";
import { USER_ROLES } from "../src/constants/userRoles.js";
import {
  getRoleHomeRoute,
  getSafeRedirectPath,
  isRouteAllowedForUser,
} from "../src/utils/authRouteUtils.js";

const orderTakerOnly = {
  role: USER_ROLES.ADMIN,
  allowedRoutes: [ADMIN_ROUTES.ORDER_TAKER],
};

test("an admin can only open staff pages explicitly assigned to the profile", () => {
  assert.equal(isRouteAllowedForUser(orderTakerOnly, ADMIN_ROUTES.ORDER_TAKER), true);
  assert.equal(isRouteAllowedForUser(orderTakerOnly, ADMIN_ROUTES.KDS), false);
  assert.equal(getRoleHomeRoute(orderTakerOnly), ADMIN_ROUTES.ORDER_TAKER);
  assert.equal(getSafeRedirectPath(orderTakerOnly, ADMIN_ROUTES.KDS), ADMIN_ROUTES.ORDER_TAKER);
});

test("a Super Admin keeps access to the Super Admin route group", () => {
  assert.equal(isRouteAllowedForUser({ role: USER_ROLES.SUPER_ADMIN }, "/super-admin/staff-shifts"), true);
});
