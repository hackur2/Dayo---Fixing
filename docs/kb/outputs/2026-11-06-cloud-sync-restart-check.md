# Restarting cloud sync after the local import

The local import retired pending local changes and superseded unfinished batches in the same transaction. Activity after the import may have created new work. The worker polls immediately after startup and can upload eligible queued records automatically. [Import queue cleanup](2026-11-06-02-local-import.sql#L162) · [Worker startup](../../../sync/worker.mjs#L156) · [Batch selection](../../../supabase/snippets/cloud_sync_local_setup.sql#L158)

Run this check in local Supabase Studio while the worker is stopped and local edits are paused.

```sql
select
  (select count(*) from local_sync.outbox
   where sync_status in ('pending', 'failed')) as queued_changes,
  (select count(*) from local_sync.batches
   where confirmed_at is null and superseded_at is null) as unfinished_batches;
```

If both values are zero, the worker can start with an empty outbound business queue. Watch Docker logs or the dashboard's cloud-check time for the first connectivity check. This startup result does not test acceptance of later local edits. The worker reports online availability and may pull active cloud orders when that feature is deployed. If either count is nonzero, inspect the queued work before starting because it may be uploaded automatically. Cloud row ownership and independently changed rows still affect subsequent edits. No live queue or worker state was inspected for this review. [Empty-queue behavior](../../../sync/engine.mjs#L76) · [Cloud conflict checks](../../../supabase/migrations/20261030000005_sync_receiver_performance.sql#L71)
