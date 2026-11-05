# Deployment and sync

Updated 2026-11-06. This page describes repository code and identifies changes found only in the worktree. Live deployment status is unknown.

## Deployment and database setup

- Docker Compose in `docker/` builds the local-mode Vite bundle, serves it via Nginx, and runs the sync worker separately. Vercel uses the default cloud mode. Both hosts provide SPA fallbacks. The local Super Admin dashboard shows the Sync to Cloud and Online ordering controls. [Docker Compose](../../../docker/docker-compose.yml) · [Dockerfile](../../../docker/Dockerfile) · [Nginx](../../../nginx.conf) · [Vercel](../../../vercel.json) · [Dashboard](../../../src/pages/superAdmin/SuperAdminDashboardPage.jsx)
- The checked-in database baseline is `20261020143115_remote_schema.sql`. Apply subsequent migrations in filename order. The local Supabase seed configuration lists a Git-ignored `seed.sql` followed by `cloud_sync_local_setup.sql`. Apply that snippet on the local database only. Cloud push applies versioned migrations. The local reset command recreates the local database. [Baseline migration](../../../supabase/migrations/20261020143115_remote_schema.sql) · [Supabase config](../../../supabase/config.toml) · [Local setup](../../../supabase/snippets/cloud_sync_local_setup.sql) · [Package scripts](../../../package.json)
- The browser uses a Supabase publishable key. The worker uses its own local PostgreSQL connection and cloud service-role credential. Docker Compose expects its environment file in `docker/` when using the checked-in local setup instructions. [Supabase browser client](../../../src/lib/supabase.js) · [Docker environment template](../../../docker/.env.docker.local.example) · [Worker runbook](../../../sync/README.md#install-or-upgrade)

## Outbound sync

- Only authorized local Super Admins can request and inspect a sync run. The outbox captures changes with the business transaction, and the worker sends final row snapshots grouped by committed transaction. Manual requests are polled at a default interval of two seconds and automatic retries at five minutes. [Outbox setup](../../../supabase/snippets/cloud_sync_local_setup.sql) · [Sync worker](../../../sync/worker.mjs) · [Sync engine](../../../sync/engine.mjs)
- The default outbound window is 3,600 seconds. Orders qualify by creation time, their items and deduction markers follow the order, and mutable inventory records qualify by update time. Older work is retained as deferred. Stable batch IDs and cloud receipts make retries safe. Local acknowledgement follows matching cloud confirmation, and a newer local edit stays pending. Empty successful checks advance the cloud-check timestamp only. [Runbook](../../../sync/README.md#current-scope-the-past-hour) · [Sync engine](../../../sync/engine.mjs)
- To reconcile dashboard totals, compare the local and cloud sets of unique `order_number` values, then compare statuses and order-item subtotals for matching orders. Aggregate differences cannot identify cloud-only rows. [Order schema](../../../supabase/migrations/20261020143115_remote_schema.sql#L238) · [Dashboard service](../../../src/services/dashboardService.js#L29)
- The receiver protects independent cloud edits, validates the full transaction, and reports business conflicts as HTTP 409. Local deletes are skipped for cloud propagation. The queue and batch history are evidence for recovery. [Safe receiver](../../../supabase/migrations/20261030000003_safe_cloud_sync.sql) · [Conflict migration](../../../supabase/migrations/20261031000000_sync_conflict_http_errors.sql) · [Historical repair](../../cloud-sync-repair-20261031.md)
- **Sync to Cloud is not a cloud replacement command.** It sends eligible local INSERT/UPDATE snapshots and intentionally skips local DELETEs. A cloud row that differs from the last confirmed local source value conflicts instead of being overwritten. Replacing cloud business data with the local database therefore needs an owner-approved backup, explicit cloud/metadata handoff, a confirmed local baseline, and post-sync verification; the live procedure is not verified. [Saved replacement-sync assessment](../outputs/2026-11-06-local-to-cloud-replacement-sync.md) · [Local setup](../../../supabase/snippets/cloud_sync_local_setup.sql) · [Safe receiver](../../../supabase/migrations/20261030000003_safe_cloud_sync.sql)
- The owner selected cloud as the source for a one-time copy to local on 2026-11-06. The SQL Editor procedure exports the 19 business tables, verifies a local import inside a transaction, backs up replaced rows privately, and retires pending outbound work. The owner's post-import SQL result shows a local backup and totals that match the exported snapshot. Check the outbound queue before restarting because the worker polls at startup. A successful empty-queue check leaves acceptance of later edits and cloud ownership unverified. [Cloud-to-local copy procedure](../outputs/2026-11-06-cloud-to-local-copy.md) · [Import verification](../outputs/2026-11-06-cloud-to-local-verification.md) · [Restart check](../outputs/2026-11-06-cloud-sync-restart-check.md)
- After a one-time import, ongoing menu and inventory sync still flows from local to cloud. The inbound KDS path in the worktree copies active orders and their lines. Cloud menu edits require explicit reconciliation. [Menu sync direction](../outputs/2026-11-06-cloud-menu-edit-direction.md) · [Worker](../../../sync/worker.mjs#L40)

## Online availability and cloud KDS

- DaYo can use inbound cloud sync and still support local-first restaurant operations if its core on-site workflows can save through the local stack during internet outages. Cloud-only ordering needs connectivity, and any future inbound menu edits need explicit conflict handling. [Local-first assessment](../outputs/2026-11-06-local-first-and-cloud-pull.md) · [Local-first software paper](https://www.inkandswitch.com/essay/local-first/)

- The worker reports the local operator's setting to cloud on a nominal five-second heartbeat. The database trigger for new QR orders requires the switch to be on and a heartbeat newer than 45 seconds. The migration installs the check on both databases and exempts mirror replay. POS orders use their own flow. Cloud UI displays effective availability, and the database enforces the final decision. [Worker](../../../sync/worker.mjs) · [Availability migration](../../../supabase/migrations/20261103000000_online_ordering_availability.sql) · [UI hook](../../../src/hooks/useOnlineOrderingAvailability.js)
- The hosted dashboard can use cloud data while the local services are offline. Durable cloud-to-local catch-up and accepting new QR orders without a local heartbeat are separate design changes. [Docker-off design assessment](../outputs/2026-11-06-cloud-dashboard-docker-off.md)

The 2026-11-06 scan found an uncommitted cloud KDS migration (`supabase/migrations/20261104000000_local_kds_cloud_orders.sql`) and worker changes. The proposed pull reads Pending, Preparing, and Ready cloud orders while outbound sync is idle. It upserts orders and lines locally by cloud ID and suppresses outbox capture for those writes. Verify ID collisions, local foreign-key references, and a poll arriving before a local KDS status update reaches the cloud when testing this path. [Order and item foreign keys](../../../supabase/migrations/20261020143115_remote_schema.sql#L1354)

## Related topics

- [System overview](system-overview.md)
- [Ordering and access](ordering-and-access.md)
- [Verification and source map](verification.md)

<!-- kb:backlinks:start -->
## Backlinks

- [Wiki index](index.md)
- [Inventory and reporting](inventory-and-reporting.md)
- [Ordering and access](ordering-and-access.md)
- [Saved answers and wiki contributions](outputs.md)
- [System overview](system-overview.md)
- [Verification and source map](verification.md)
<!-- kb:backlinks:end -->
