# Demo ingredient consumption and reorder points

`demo_ingredient_consumption_30_days.sql` supplies the missing consumption input for the existing automatic reorder-point calculation. It uses completed, paid annual-demo orders from the rolling preceding **30 × 24 hours**, with the exact original `[DAYO DEMO YEAR V1] Synthetic analytics data; not a real sale.` note and `DAYO-DEMO-Y1-` order-number prefix.

For each order and ingredient, usage is the sum of **ordered quantity × current recipe quantity**, rounded to three decimals in the ingredient's stored unit. This is an estimate for demonstration; current recipes are not historical recipe snapshots. No new recipe links are invented. Ingredients without qualifying usage can correctly retain a zero reorder point.

Each new movement has a negative adjustment, its original order ID and sale timestamp, and an explicit `Order DAYO-DEMO-Y1-… [DAYO DEMO ROP V1] completed` reason. This matches the app's existing completed-order usage filter and visibly identifies the synthetic rows. Current stock is not deducted again. The script adds no orders, sales revenue, prices, indexes, functions, permissions, expiry setup, or sync jobs.

## Calculation and validation

The existing formula is `ADS = recorded usage / 30`, `safety stock = ADS × 1 day`, and `ROP = ADS × 1 lead-time day + safety stock`. ROP rounds upward to three decimals. For example, 300 Pcs of usage gives ADS 10 Pcs/day, safety stock 10 Pcs, and ROP **20 Pcs**.

The script returns the affected order/movement counts and a per-ingredient report of demo usage, total usage, ADS, safety stock, and expected ROP. Real completed-order usage, when present, contributes to the total normally. The frontend computes these values even on databases without `refresh_ingredient_reorder_points()`; it does not need a hard-coded threshold or a new schema migration. If automatic ROP triggers are already installed, they can also update the stored `reorder_level`.

Run `node --test --test-concurrency=1 tests/demoIngredientConsumption.test.mjs` for isolated PostgreSQL tests using the real table definitions, expiry functions, optional reorder triggers, and the app's actual JavaScript formula. Tests cover the manual example, original dates/order links, repeat runs, existing deductions, recipe drift, missing inputs, trigger rollback, and exclusion from local cloud-sync capture.

## Running it

1. Test on a separate copy of the target database and retain a backup of ingredient rows and stock movements.
2. Open local Supabase Studio's SQL Editor. Copy the **entire** SQL file into a new query and run it as `postgres`.
3. Review the returned report and refresh Ingredients. All values remain demonstrations, including consumption-based reports that also use these ledger rows.

The local import uses the existing transaction-scoped `app.sync_source = 'cloud_mirror'` maintenance flag to avoid queuing historical demo data for upload. It validates that any installed capture function understands this flag. It does not start or retry cloud synchronization, change the past-hour sync window, or upload the year's sales again. No cloud database is changed automatically.

The script locks its input tables briefly and runs atomically. Current stock, unit costs, units, expiry fields, ingredient membership, existing movements, orders, order items, and recipes are checked for unintended changes. Any detected change rolls back the import. Existing movements are never rewritten. Repeating the import adds no duplicates; conflicting existing tagged usage or recipe drift causes a clear error. Orders already having normal completion deductions are skipped to prevent double counting.

Original timestamps remain unchanged. Usage naturally ages out of the rolling window, so these sample values will decline after the last demo sale on October 30, 2026. This script does not keep generating new sales or move dates forward.

## Local demonstration on October 31, 2026

After passing all six isolated tests and validation against a copy of the local recipe/demo data, the script was applied locally at 00:29 Asia/Manila. It added **1,956** labeled movements for **552** recent demo orders, producing nonzero calculated reorder points for **20 of 21** ingredients. Egg has 231 Pcs of usage, ADS 7.7 Pcs/day, safety stock 7.7 Pcs, and ROP **15.4 Pcs**. Matcha has ROP **20 mL**. Plastic Cups 16 oz remains zero because it has no qualifying demo recipe usage.

Before/after checks confirmed every ingredient row, existing ledger entry, order, order item, and recipe remained unchanged. No duplicate demo order/ingredient groups or invalid order/date links were found. The cloud outbox and record-status counts were unchanged. Repeating the import on the isolated copy added **zero** movements. Backups, test input, import output, and verification results are retained in the Git-ignored `supabase/backups/*20261031*.local` files. No frontend deployment was required; refresh Ingredients to load the new ledger input.
