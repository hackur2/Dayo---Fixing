# Cloud Supabase analytics sample data

Open `cloud_analytics_sample_year.sql`, copy **the entire file**, and run it in your **cloud project's Supabase SQL Editor** as `postgres`. Do not paste Markdown code fences or execute only a selected fragment. This file has been prepared and tested in isolation; it has not been executed against your cloud database.

The script uses the existing cloud menu and generates **6,009 completed, paid sample orders** for **October 31, 2025–October 30, 2026**, inclusive, in Philippine time. Each order has 1–3 lines, with existing item/variant prices and varied quantities. Daily demand varies by weekday, month and date; weighted demand creates fast- and slow-moving items under the current chart formulas.

These records feed Revenue Monitoring, its revenue chart, Customer Map (orders per day), Sales Trend, and Fast-moving / Slow-moving. Total Orders, Top Menu and other summaries derived from the same orders also include the demo records.

The approved stock rules are retained: fill eligible zero quantities and missing/zero illustrative unit costs, preserve positive quantities/costs, log each actual refill, and skip expired/archived ingredients and unknown units. `unit_cost` is added if absent. Illustrative costs are 8 pesos/Pcs, 0.12 pesos/gram, 0.06 pesos/mL, 120 pesos/kg, and 60 pesos/L. Expiry dates, unit conversions, recipes, menu items, staff, suppliers and promotions are not changed or created.

The sample import marks historical orders as already accounted for in the existing inventory-deduction ledger. It does not consume today's inventory. The transaction-scoped import flag uses existing mirror guards where available. No local sync schema is required, created or configured. Existing cloud sync metadata is not modified by the script.

Demo order numbers and the note marker match the local sample script. This avoids duplicate insertion if those exact demo orders already reached cloud, and makes repeating this script safe. Existing incomplete tagged orders or conflicting use of the reserved prefix cause the transaction to abort for review. Independently inserted cloud and local records can still have different database IDs; this file does not reconcile the already-pending local sync batch.

As requested, this file includes **sample data only**: it does not add the proposed dashboard index, install expiry clearing, change permissions, or restart/retry cloud synchronization. The dashboard timeout diagnosed earlier still needs its separate correction if the cloud database has the same missing index.

The result sets list monthly revenue/order coverage, exact stock/cost changes, skipped rows, and the final import summary. Revenue amounts depend on your current cloud menu prices. If the SQL Editor reports an error and leaves the transaction open, run `rollback;` and review that error before rerunning the entire file.

Your LAN app at `http://192.168.254.104:5173` currently reads the **local** database. Running this cloud SQL populates **cloud** records; the LAN app's database connection is not changed by the script.

Validation: `node --test --test-concurrency=1 tests/cloudAnalyticsSampleYear.test.mjs tests/localAnalyticsSampleYear.test.mjs`. Tests cover 365-day chart coverage, both movement classifications, existing sales preservation, expiry-trigger safety, costs/refill boundaries, no new indexes, no local-sync dependency, preserved cloud metadata, repeat runs and incomplete demo rollback.
