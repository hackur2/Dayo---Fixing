# Local analytics sample year

Open `local_analytics_sample_year.sql`, copy the entire file into the **local** Supabase Studio SQL Editor at <http://localhost:54323>, and run it. Refresh Dayo afterward. The file has been tested in an isolated Postgres engine; it has not been applied to the running database.

The approved date range is **October 31, 2025 through October 30, 2026**, inclusive, in Asia/Manila time. It spans 365 days and parts of 13 calendar months. The dates are fixed near the top of the SQL so repeat runs keep the same sample period.

## Included

- Paid, completed sample orders using the existing active menu, prices, categories and variants, with varied daily demand, quantities, weekend peaks and growth. Weighted demand within each menu category creates fast- and slow-moving items. An item in a category by itself will naturally remain fast-moving under the app's existing formula.
- Revenue Monitoring total/chart, Customer Map (non-cancelled orders per day), Sales Trend (hour/day/week/month), and the movement card all read these same orders. Total Orders, Top Menu, payment/order source summaries, and revenue breakdown also reflect them automatically.
- `ingredients.unit_cost` is added if absent, as approved. Missing/zero costs on eligible ingredients receive **illustrative** per-unit prices: 8 pesos/Pcs, 0.12 pesos/gram, 0.06 pesos/mL, 120 pesos/kg, or 60 pesos/L. Existing positive costs are kept. These prices are placeholders for visual demonstrations.
- Eligible zero stock quantities receive 60 Pcs, 5,000 grams/mL, or 5 kg/L, increased when necessary to cover twice the reorder level or 100 recipe portions. Each refill records one positive stock movement. Existing positive stock quantities are kept.

## Boundaries

- Existing orders are retained. Every sample order has a `DAYO-DEMO-Y1-` number, a `Demo Customer` name, and a `[DAYO DEMO YEAR V1]` note. Re-running the file does not duplicate orders or refill already-positive stock. It aborts if the reserved prefix belongs to an unrelated record.
- No staff, suppliers, promotions, ratings, AI recommendations, recipes, categories, or menu items are created. No historical stock usage is invented. Sales history is recorded as already accounted for, using the existing inventory-deduction ledger, so it does not consume current stock.
- The script excludes its writes from the installed local sync queue using the existing transaction-scoped `app.sync_source` flag. It checks compatibility with the installed capture function. The flag resets at transaction end. A later explicit full re-export/baseline of the database could include these demo records; do not use this local demo database as a production export source.
- Expired/archived ingredients and unknown stock units are skipped. Expiry dates, restoration, stock disposal and unit conversion require separate approval. The result set lists any skipped rows.
- The existing Reorder Point/Potential Excess calculations use real stock-movement history. They will not acquire synthetic annual consumption from these sample sales. Previous-period revenue comparison works where both selected periods fall within the seeded year; a comparison requiring earlier history will still have no demo baseline for those earlier dates.

## Results and checks

The SQL returns monthly order/revenue totals, exact inventory edits, skipped ingredients, and a final summary with date coverage and counts. All writes run in one transaction. If the editor reports an error and leaves the transaction open, run `rollback;` before retrying the entire file.

On inspection, the local database had 31 active menu items, 21 ingredients, and no zero stock quantities. It had no `unit_cost` column. Several ingredient expiry dates had passed; those rows remain untouched by this sample import.

Validation: `node --test tests/localAnalyticsSampleYear.test.mjs` checks 365-day chart coverage, positive revenue, prior-period comparisons, customer activity, movement classifications, shared/own variant prices, preservation of existing rows, eligible stock/cost fills, ledger entries, transaction flag reset, exclusion from cloud capture, repeat runs, and prefix collision rollback.

Optional reorder-point demonstration: the separately approved [demo ingredient consumption import](DEMO_INGREDIENT_CONSUMPTION_README.md) derives labeled usage from the past 30 days of these orders and current recipes. The year-sales script itself continues to create no historical consumption or repeat inventory deductions.
