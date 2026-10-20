# DaYo Admin and Super Admin Data Contract

This document explains the expected API data format for the Admin and Super Admin side of DaYo.

The frontend will use sample/mock data first. Once the backend is ready, the frontend should connect to API endpoints that follow this contract.

---

# Important Naming Rule

The database may use snake_case internally.

Example:

```txt
order_number
total_amount
created_at
```

But API responses sent to React should use camelCase.

Example:

```txt
orderNumber
totalAmount
createdAt
```

---

# 1. Admin Kitchen Display System

## Endpoint

```http
GET /api/orders/kds
```

## Purpose

Returns active orders for the Kitchen Display System.

The KDS should show orders with these statuses:

```txt
Pending
Preparing
Ready
```

It should usually hide:

```txt
Completed
Cancelled
```

## Example Response

```json
[
  {
    "id": 101,
    "orderNumber": "DY-928391",
    "customerName": "Juan Dela Cruz",
    "orderType": "Dine In",
    "status": "Pending",
    "notes": "No chili sauce please.",
    "items": [
      {
        "menuItemId": 1,
        "name": "Pastil Rice with Soup",
        "selectedVariantId": null,
        "variantLabel": null,
        "quantity": 2,
        "price": 55,
        "subtotal": 110
      },
      {
        "menuItemId": 17,
        "name": "Drip Coffee",
        "selectedVariantId": "16oz",
        "variantLabel": "16 oz",
        "quantity": 1,
        "price": 80,
        "subtotal": 80
      }
    ],
    "totalAmount": 190,
    "createdAt": "2026-07-20T14:30:00.000Z"
  }
]
```

---

# 2. Update Order Status

## Endpoint

```http
PATCH /api/orders/:orderNumber/status
```

## Purpose

Allows Admin/Staff to update the status of an order.

## Request Body

```json
{
  "status": "Preparing"
}
```

## Possible Status Values

```txt
Pending
Preparing
Ready
Completed
Cancelled
```

## Example Response

```json
{
  "orderNumber": "DY-928391",
  "status": "Preparing",
  "updatedAt": "2026-07-20T14:35:00.000Z"
}
```

---

# 3. Manual POS Order

## Endpoint

```http
POST /api/orders/manual
```

## Purpose

Allows Admin/Staff to create walk-in customer orders manually.

## Request Body

```json
{
  "staffName": "Admin User",
  "customerName": "Walk-in Customer",
  "orderType": "Dine In",
  "paymentMethod": "Cash",
  "notes": "",
  "items": [
    {
      "menuItemId": 7,
      "selectedVariantId": null,
      "variantLabel": null,
      "price": 70,
      "quantity": 1
    },
    {
      "menuItemId": 17,
      "selectedVariantId": "12oz",
      "variantLabel": "12 oz",
      "price": 60,
      "quantity": 1
    }
  ]
}
```

## Backend Responsibility

The backend should:

```txt
1. Validate staff/admin user.
2. Validate customer name and order type.
3. Validate selected menu items.
4. Validate item prices using the database.
5. Validate available stock.
6. Create the manual order.
7. Create order item records.
8. Deduct inventory after confirmation/completion.
9. Return the created order.
```

## Example Response

```json
{
  "id": 102,
  "orderNumber": "DY-928392",
  "customerName": "Walk-in Customer",
  "orderType": "Dine In",
  "paymentMethod": "Cash",
  "status": "Pending",
  "notes": "",
  "items": [
    {
      "menuItemId": 7,
      "name": "Siomai Rice with Egg & Soup",
      "selectedVariantId": null,
      "variantLabel": null,
      "price": 70,
      "quantity": 1,
      "subtotal": 70
    },
    {
      "menuItemId": 17,
      "name": "Drip Coffee",
      "selectedVariantId": "12oz",
      "variantLabel": "12 oz",
      "price": 60,
      "quantity": 1,
      "subtotal": 60
    }
  ],
  "totalAmount": 130,
  "createdAt": "2026-07-20T14:40:00.000Z"
}
```

---

# 4. Order Summary / Order History

## Endpoint

```http
GET /api/orders
```

## Optional Filters

```http
GET /api/orders?date=2026-07-20
GET /api/orders?status=Completed
GET /api/orders?from=2026-07-01&to=2026-07-20
```

## Purpose

Returns order history for Admin and Super Admin.

## Example Response

```json
[
  {
    "id": 101,
    "orderNumber": "DY-928391",
    "customerName": "Juan Dela Cruz",
    "orderType": "Dine In",
    "status": "Completed",
    "totalAmount": 190,
    "createdAt": "2026-07-20T14:30:00.000Z"
  },
  {
    "id": 102,
    "orderNumber": "DY-928392",
    "customerName": "Walk-in Customer",
    "orderType": "Take Out",
    "status": "Completed",
    "totalAmount": 130,
    "createdAt": "2026-07-20T14:40:00.000Z"
  }
]
```

---

# 5. Get Single Order Details

## Endpoint

```http
GET /api/orders/:orderNumber
```

## Example

```http
GET /api/orders/DY-928391
```

## Purpose

Returns the full details of one order.

## Example Response

```json
{
  "id": 101,
  "orderNumber": "DY-928391",
  "customerName": "Juan Dela Cruz",
  "orderType": "Dine In",
  "status": "Completed",
  "notes": "No chili sauce please.",
  "items": [
    {
      "menuItemId": 1,
      "name": "Pastil Rice with Soup",
      "selectedVariantId": null,
      "variantLabel": null,
      "quantity": 2,
      "price": 55,
      "subtotal": 110
    },
    {
      "menuItemId": 17,
      "name": "Drip Coffee",
      "selectedVariantId": "16oz",
      "variantLabel": "16 oz",
      "quantity": 1,
      "price": 80,
      "subtotal": 80
    }
  ],
  "totalAmount": 190,
  "createdAt": "2026-07-20T14:30:00.000Z"
}
```

---

# 6. Super Admin Dashboard Summary

## Endpoint

```http
GET /api/dashboard/summary
```

## Optional Filters

```http
GET /api/dashboard/summary?from=2026-07-01&to=2026-07-20
```

## Purpose

Returns summary cards and quick insights for the Super Admin dashboard.

The dashboard is for quick overview only. Detailed visual charts belong to the Sales Graph page.

## Example Response

```json
{
  "totalSales": 12450,
  "totalOrders": 148,
  "averageOrderValue": 84.12,
  "lowStockCount": 5,
  "pendingOrdersCount": 7,
  "completedOrdersCount": 141,
  "topSellingItems": [
    {
      "menuItemId": 7,
      "name": "Siomai Rice with Egg & Soup",
      "quantitySold": 42,
      "totalSales": 2940
    },
    {
      "menuItemId": 17,
      "name": "Drip Coffee",
      "quantitySold": 38,
      "totalSales": 2280
    }
  ],
  "lowSellingItems": [
    {
      "menuItemId": 3,
      "name": "Chicken Tenders with Soup",
      "quantitySold": 4,
      "totalSales": 300
    }
  ],
  "recentOrders": [
    {
      "orderNumber": "DY-928391",
      "customerName": "Juan Dela Cruz",
      "status": "Completed",
      "totalAmount": 190,
      "createdAt": "2026-07-20T14:30:00.000Z"
    }
  ]
}
```

---

# 7. Sales Graph Data

## Endpoint

```http
GET /api/reports/sales-graph
```

## Optional Filters

```http
GET /api/reports/sales-graph?from=2026-07-01&to=2026-07-20
GET /api/reports/sales-graph?groupBy=day
GET /api/reports/sales-graph?groupBy=month
GET /api/reports/sales-graph?metric=sales
GET /api/reports/sales-graph?metric=orders
```

## Purpose

Returns sales data used for visual charts in the Super Admin Sales Graph page.

This page may display:

```txt
Daily sales graph
Monthly sales graph
Sales by category
Top-selling items
Low-selling items
Total orders by period
```

## Example Response

```json
{
  "groupBy": "day",
  "salesByPeriod": [
    {
      "label": "Jul 18",
      "totalSales": 4200,
      "totalOrders": 51
    },
    {
      "label": "Jul 19",
      "totalSales": 3800,
      "totalOrders": 45
    },
    {
      "label": "Jul 20",
      "totalSales": 4450,
      "totalOrders": 52
    }
  ],
  "salesByCategory": [
    {
      "category": "Student Meals",
      "totalSales": 6200
    },
    {
      "category": "Drink",
      "totalSales": 4100
    },
    {
      "category": "Food",
      "totalSales": 2150
    }
  ],
  "topSellingItems": [
    {
      "menuItemId": 7,
      "name": "Siomai Rice with Egg & Soup",
      "quantitySold": 42,
      "totalSales": 2940
    },
    {
      "menuItemId": 17,
      "name": "Drip Coffee",
      "quantitySold": 38,
      "totalSales": 2280
    }
  ],
  "lowSellingItems": [
    {
      "menuItemId": 3,
      "name": "Chicken Tenders with Soup",
      "quantitySold": 4,
      "totalSales": 300
    }
  ]
}
```

---

# 8. Inventory List

## Endpoint

```http
GET /api/inventory
```

## Purpose

Returns inventory items and their stock status.

## Example Response

```json
[
  {
    "id": 1,
    "itemName": "Siomai",
    "category": "Food Ingredient",
    "unit": "pcs",
    "currentStock": 40,
    "reorderLevel": 25,
    "status": "In Stock",
    "lastUpdated": "2026-07-20T13:00:00.000Z"
  },
  {
    "id": 2,
    "itemName": "Rice",
    "category": "Food Ingredient",
    "unit": "cups",
    "currentStock": 10,
    "reorderLevel": 15,
    "status": "Low Stock",
    "lastUpdated": "2026-07-20T13:00:00.000Z"
  },
  {
    "id": 3,
    "itemName": "Coffee Beans",
    "category": "Drink Ingredient",
    "unit": "grams",
    "currentStock": 0,
    "reorderLevel": 500,
    "status": "Out of Stock",
    "lastUpdated": "2026-07-20T13:00:00.000Z"
  }
]
```

## Possible Inventory Status Values

```txt
In Stock
Low Stock
Out of Stock
```

---

# 9. Update Inventory Quantity

## Endpoint

```http
PATCH /api/inventory/:id
```

## Purpose

Allows Super Admin to update inventory quantity or reorder level.

## Request Body

```json
{
  "currentStock": 50,
  "reorderLevel": 20
}
```

## Example Response

```json
{
  "id": 1,
  "itemName": "Siomai",
  "category": "Food Ingredient",
  "unit": "pcs",
  "currentStock": 50,
  "reorderLevel": 20,
  "status": "In Stock",
  "lastUpdated": "2026-07-20T15:00:00.000Z"
}
```

---

# 10. Stock Movement Records

## Endpoint

```http
GET /api/inventory/stock-movements
```

## Purpose

Returns inventory movement history.

Stock movement means any increase or decrease in inventory.

Examples of movement types:

```txt
Stock In
Stock Out
Order Deduction
Manual Adjustment
Waste
```

## Example Response

```json
[
  {
    "id": 1,
    "inventoryItemId": 1,
    "itemName": "Siomai",
    "movementType": "Order Deduction",
    "quantityChanged": -4,
    "previousStock": 44,
    "newStock": 40,
    "reason": "Order DY-928391 completed",
    "createdAt": "2026-07-20T14:45:00.000Z"
  },
  {
    "id": 2,
    "inventoryItemId": 2,
    "itemName": "Rice",
    "movementType": "Manual Adjustment",
    "quantityChanged": 20,
    "previousStock": 10,
    "newStock": 30,
    "reason": "Restocked rice supply",
    "createdAt": "2026-07-20T15:10:00.000Z"
  }
]
```

---

# 11. Customer Feedback Monitoring

## Endpoint

```http
GET /api/feedback
```

## Purpose

Returns customer feedback for Super Admin review.

## Example Response

```json
[
  {
    "id": "FB-123456",
    "orderNumber": "DY-928391",
    "customerName": "Juan Dela Cruz",
    "rating": 5,
    "comment": "The food was delicious and affordable.",
    "createdAt": "2026-07-20T14:40:00.000Z"
  },
  {
    "id": "FB-123457",
    "orderNumber": "DY-928392",
    "customerName": "Walk-in Customer",
    "rating": 4,
    "comment": "Good food, but waiting time can improve.",
    "createdAt": "2026-07-20T15:05:00.000Z"
  }
]
```

---

# 12. Staff Shift Monitoring

## Endpoint

```http
GET /api/staff-shifts
```

## Purpose

Returns staff shift records.

## Example Response

```json
[
  {
    "id": 1,
    "staffName": "Maria Santos",
    "role": "Staff",
    "shiftDate": "2026-07-20",
    "timeIn": "2026-07-20T08:00:00.000Z",
    "timeOut": "2026-07-20T17:00:00.000Z",
    "totalHours": 9
  },
  {
    "id": 2,
    "staffName": "Admin User",
    "role": "Admin",
    "shiftDate": "2026-07-20",
    "timeIn": "2026-07-20T09:00:00.000Z",
    "timeOut": null,
    "totalHours": null
  }
]
```

---

# 13. Error Response Format

All backend errors should follow this format:

```json
{
  "message": "Unable to update order status.",
  "details": "Order number DY-928391 was not found."
}
```

Common HTTP status codes:

```txt
200 OK
201 Created
400 Bad Request
404 Not Found
409 Conflict
500 Server Error
```

---

# 14. Frontend Responsibility

## Admin Frontend

```txt
Display active KDS orders
Display order item details
Allow order status updates
Create manual POS orders
View order summaries
Show loading and error states
```

## Super Admin Frontend

```txt
Display dashboard summaries
Display sales graph page
Display daily/monthly sales charts
Display item sales performance
Display inventory list
Display low-stock items
Allow inventory updates
Display stock movement records
Display customer feedback
Display staff shift records
Display order history
```

---

# 15. Backend Responsibility

```txt
Store official orders
Store official menu and prices
Validate order status updates
Validate manual POS orders
Deduct inventory after confirmed/completed orders
Calculate dashboard summaries
Calculate sales graph data
Calculate low-stock items
Calculate top-selling and low-selling items
Store feedback records
Store staff shift records
Return clean API responses to the frontend
```

---

# 16. Suggested Frontend Sample Data Files

Before the backend is ready, the frontend can create sample files:

```txt
src/data/sampleOrders.js
src/data/sampleInventory.js
src/data/sampleDashboard.js
src/data/sampleSalesGraph.js
src/data/sampleFeedback.js
src/data/sampleStaffShifts.js
```

These sample files should follow the same format shown in this contract.