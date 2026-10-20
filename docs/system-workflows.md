# System Workflows

## Customer QR and order

```text
QR URL with registered token
  → local access gate stores token temporarily
  → menu and active promotions load from Supabase
  → checkout calls create_customer_order RPC
  → database validates token and current menu prices
  → order and order items are stored atomically
  → when staff marks the order Completed, recipe ingredient quantities are deducted once
  → customer status reads use get_customer_order RPC
```

QR validity is enforced in Postgres using the hash in `qr_access_tokens`; the local four-hour session is only a convenience.

## Admin operations

- KDS reads active orders and updates status in Supabase.
- POS calls a role-checked RPC that re-reads current item prices and writes the order.
- Order Summary reads stored orders and order items.

## Super Admin operations

- Dashboard and sales graph aggregate actual completed orders and order items.
- Inventory reads and writes ingredients, categories, menu items, recipe rows, and stock movements.
- Staff Monitor reads and writes staff directory and shift rows.
- Feedback reads persisted customer feedback and marks rows reviewed.

## Setup requirements

Apply the SQL migrations in timestamp order. Create and authorize management accounts through Supabase Auth and `profiles`. Register an active QR token before customer ordering or feedback. Add real menu, ingredient, category, recipe, and promotion data; this repository supplies no demonstration rows. Ingredient deductions begin after applying `20261006030000_deduct_ingredients_on_order_completion.sql`; only menu items with configured recipe requirements deduct stock. Existing completed orders are not backfilled.
