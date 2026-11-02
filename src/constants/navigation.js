import { ADMIN_ROUTES, SUPER_ADMIN_ROUTES } from "./routes.js";
import { INVENTORY_VIEWS } from "./inventory.js";

export const ADMIN_NAV_LINKS = [
  {
    label: "Kitchen Display",
    path: ADMIN_ROUTES.KDS,
  },
  {
    label: "Order Taker",
    path: ADMIN_ROUTES.ORDER_TAKER,
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
    label: "Order Taker",
    path: SUPER_ADMIN_ROUTES.ORDER_TAKER,
  },
  {
    label: "Kitchen Display",
    path: SUPER_ADMIN_ROUTES.KDS,
  },
  {
    label: "Inventory",
    path: SUPER_ADMIN_ROUTES.INVENTORY,
    relatedPaths: [SUPER_ADMIN_ROUTES.POTENTIAL_EXCESS, SUPER_ADMIN_ROUTES.ITEM_MOVEMENT],
    children: [
      {
        label: "Ingredients",
        path: SUPER_ADMIN_ROUTES.INVENTORY,
        view: INVENTORY_VIEWS.INGREDIENTS,
      },
      {
        label: "Menu Items",
        path: SUPER_ADMIN_ROUTES.INVENTORY,
        view: INVENTORY_VIEWS.MENU_ITEMS,
      },
      {
        label: "Supplier",
        path: SUPER_ADMIN_ROUTES.SUPPLIER,
      },
      {
        label: "Shelf Life",
        path: SUPER_ADMIN_ROUTES.SHELF_LIFE,
      },
      {
        label: "Low Stock",
        path: SUPER_ADMIN_ROUTES.LOW_STOCK,
      },
    ],
  },
  {
    label: "Archive",
    path: SUPER_ADMIN_ROUTES.INVENTORY_ARCHIVE,
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
