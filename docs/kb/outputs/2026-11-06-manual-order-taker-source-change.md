# Store manual orders as Manual Order Taker

The owner confirmed that `Manual POS` should become `Manual Order Taker` in `public.orders.source`. The table, column, and `QR Order` default retain their names and behavior. This supersedes the scope question in the [naming assessment](2026-11-06-order-taker-naming.md). The change is prepared in the repository and has not been applied to either live database.

The migration renames historical rows and canonicalizes new writes from the existing order RPC and old seed SQL. It preserves order timestamps and updates the matching source label in sync baselines without rewriting historical events or receipt hashes. It refuses to proceed if legacy order events can still be uploaded. Dashboard totals and Order Summary filters accept either spelling and display the existing Order Taker label. [Migration](../../../supabase/migrations/20261106000000_manual_order_taker_source.sql) · [Source normalization](../../../src/utils/orderUtils.js) · [Dashboard](../../../src/services/dashboardService.js) · [Order Summary](../../../src/pages/superAdmin/SuperAdminOrdersPage.jsx)

## Rollout

1. Deploy the compatible frontend builds to local Docker and Vercel before switching stored values.
2. Back up both databases, pause order writes, and let the existing worker resolve pending or failed legacy order uploads. Stop `cloud-sync` before the database change.
3. Apply the linked migration in the local SQL Editor first, then in the cloud SQL Editor. Resume order writes and `cloud-sync` after both succeed. If the local migration reports queued legacy orders, review and resolve the backlog before proceeding to cloud. Keep historic batches and receipts intact.
4. Compare source counts before and after the migration on each database. Create a manual order in a test environment and check that it appears under Order Taker in the reports.

```sql
select source, count(*) as orders
from public.orders
group by source
order by source;
```

## Verification

`node --test --test-concurrency=1 tests/manualOrderSourceSql.test.mjs tests/dashboardService.test.mjs` passed all 20 focused tests. The SQL test covers legacy queue blocking, historical timestamps, unchanged QR orders, the normal manual-order RPC, captured new values, and cloud receiver compatibility. `npm.cmd run build` passed. Browser and live deployment behavior have not been verified. [SQL regression test](../../../tests/manualOrderSourceSql.test.mjs) · [Dashboard regression test](../../../tests/dashboardService.test.mjs)
