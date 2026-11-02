# Ingredient expiry: zero stock, keep the ingredient

1. **Correct an earlier expiry installation:** run all of `ingredient_expiry_stock_only.sql` in Supabase SQL Editor on the primary and mirror (if used). It returns automatically expiry-archived ingredients to Inventory with **zero stock**, removes those expiry entries from the visible Archive list, and preserves manually deleted ingredients and stock-loss history. The result lists the restored ingredients. Re-running it does not reset stock on ingredients that have since been restocked with a future expiry date.
2. **Fresh installation:** run `ingredient_expiry_setup.sql`, then `ingredient_expiry_schedule.sql` on the primary inventory database only. The scheduler runs every minute. Apply the setup to the cloud mirror as well, but schedule only on the primary. Existing jobs using the earlier expiry RPC stay compatible: that RPC now delegates to stock clearing and never archives ingredients.
3. Refresh the app. The database-setup notification disappears once the new RPC is available.

If SQL Editor reports an **unterminated dollar-quoted string**, a function body was pasted or selected without its closing delimiter. Open `ingredient_expiry_stock_only.sql`, select the whole file with **Ctrl+A**, copy it into a fresh SQL Editor query, and run the entire query with no partial selection. That correction file uses standard quoted function bodies to avoid missing dollar-quote delimiters. Copy through the final `END OF INGREDIENT EXPIRY CORRECTION` comment; do not add Markdown code fences.

Expiry begins on the expiry date in Asia/Manila time. Current stock becomes **zero**, and the ingredient **stays in Inventory**. No new Archive record is created. Recipe references remain intact. Discarded stock is logged as expiry loss and excluded from weekly consumption. To replenish it, set a future expiry date along with the new stock amount.

The database job works while the app is closed. While open, the app also checks every 10 seconds and updates Inventory, Archive, Shelf Life, Low Stock, and Dashboard values. Near-expiry notifications show only stocked ingredients with 1–3 days remaining, and link to Shelf Life.

If creating `pg_cron` is unavailable, enable Cron in Supabase **Integrations → Cron**, then rerun the scheduler file. See [Supabase Cron installation](https://supabase.com/docs/guides/cron/install).
