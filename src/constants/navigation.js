import { ADMIN_ROUTES, SUPER_ADMIN_ROUTES } from "./routes";

export const ADMIN_NAV_LINKS = [
  {
    label: "Kitchen Display",
    path: ADMIN_ROUTES.KDS,
  },
  {
    label: "POS",
    path: ADMIN_ROUTES.POS,
  },
  {
    label: "Order Summary",
    path: ADMIN_ROUTES.ORDER_SUMMARY,
  },
];

export const SUPER_ADMIN_NAV_LINKS = [
  {
    label: "Dashboard",
    path: SUPER_ADMIN_ROUTES.DASHBOARD,
  },
  {
    label: "Sales Graph",
    path: SUPER_ADMIN_ROUTES.SALES_GRAPH,
  },
  {
    label: "POS",
    path: SUPER_ADMIN_ROUTES.POS,
  },
  {
    label: "Kitchen Display",
    path: SUPER_ADMIN_ROUTES.KDS,
  },
  {
    label: "Inventory",
    path: SUPER_ADMIN_ROUTES.INVENTORY,
  },
  {
    label: "Order Summary",
    path: SUPER_ADMIN_ROUTES.ORDERS,
  },
  {
    label: "Staff Monitor",
    path: SUPER_ADMIN_ROUTES.STAFF_SHIFTS,
  },
  {
    label: "Feedback",
    path: SUPER_ADMIN_ROUTES.FEEDBACK,
  },
  {
    label: "Customer QR",
    path: SUPER_ADMIN_ROUTES.QR_ACCESS,
  },
];
