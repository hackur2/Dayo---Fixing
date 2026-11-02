Ingredient reorder points use a shared lead time of 1 day and a buffer of 1 day:

- ADS = ingredient units consumed by completed orders during the last 30 days / 30.
- Safety stock = ADS x 1.
- ROP = ADS x 1 + safety stock.

The app calculates Inventory, Low Stock, Dashboard, and restock notifications from the stock ledger. Negative deductions matching `Order ... completed` count as ingredient sales. Manual adjustments, restocks, and expiry losses do not count. The window is the rolling 30 x 24 hours ending at the calculation time, including current-day consumption. Quiet days are included in the fixed divisor of 30. A new ingredient with no recorded consumption has ADS, safety stock, and ROP of zero. Calculations retain precision until the ROP is rounded upward to the existing stock precision of 0.001 ingredient units.

Apply `supabase/migrations/20261030000001_ingredient_reorder_points.sql` on the primary database and any cloud mirror to maintain the saved `ingredients.reorder_level` automatically. It backfills current thresholds, recalculates after stock-ledger inserts/updates/deletes, and exposes a staff-only refresh RPC so older consumption ages out during app reads. It does not change ingredient stock or ingredient sales history. The app can calculate from the ledger before this optional database automation is installed; the saved database threshold is also calculated whenever an ingredient is created or edited through the app.

Cloud replay must retain `app.sync_source = 'cloud_mirror'` and the service-role account. Mirror replay does not recalculate from a partially replayed ledger; it accepts the primary's saved ingredient value through the existing sync mechanism.
