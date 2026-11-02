# Cloud sync retry-loop repair — October 31, 2026

The first blocked upload at 01:14 Asia/Manila contained menu variant 14 (`16 oz`, menu item 29). All fields matched except `sort_order`: local 1, cloud 0. The existing cloud row had no sync metadata or update timestamp, so the receiver correctly required explicit review, but incorrectly raised the business conflict as SQLSTATE `40001`.

Cloud was running PostgREST 14.18, which automatically retries serialization failures. Ten abandoned RPC requests repeatedly attempted the same failed batch and row locks, occupying its API pool. Later requests returned HTTP 504 / `PGRST003`. The advisory lock keys matched the first failed batch and variant 14. The worker was alive; the UI simplification did not change the worker or queue. Supabase documents this [PostgREST 14 retry-loop behavior](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions).

## Correction

- Stopped only `cloud-sync` while repairing, retaining the existing queue, batch IDs, receipts, and error history.
- Applied `20261031000000_sync_conflict_http_errors.sql` locally and in cloud. All five business-conflict branches now raise `PT409`; conflict ownership, versions, timestamps, schema checks, atomicity, permissions, and the 90-second function timeout are preserved. The migration validates the installed definition and can be repeated safely.
- Updated worker diagnostics to retain actual `PT409` conflict messages and distinguish `PGRST003` pool-acquisition failures from upload/client timeouts.
- Verified zero active stuck sync RPCs and zero advisory waiters after correction. The narrowly targeted cleanup query found no remaining matching sessions to terminate; the old loops had already ended.
- Explicitly reconciled only variant 14's display order to the local value 1. A transaction verified every other field and sync ownership before changing it. No general cloud-conflict override was added.
- Rebuilt/restarted only the sync worker, using its existing server credentials and unchanged 3,600-second sync window. No frontend rebuild, new sales, synthetic test RPCs, queue truncation, year-data replay, or source-ID reset was used.

## Verified result

Run `f71defb4-c33e-422d-b055-d4826b6e6ca4` succeeded at **02:41:07 Asia/Manila** with **23 distinct confirmed records**, **0 failed records**, and **0 eligible pending/failed events remaining**. Nine cloud receipts confirmed 43 record versions across the original committed transactions; repeated revisions of the same record account for the distinction from the 23 unique record keys. Each local batch confirmation was matched to its cloud receipt and record count.

Both new local orders, `DY-3D9E0DC786B3` and `DY-BD14154114BD`, were present once in cloud with Completed/Paid status and one order item each. Cloud total order count increased by exactly two. The 6,009 annual demo orders remained unchanged in count. No stuck sync requests or advisory waiters remained.

`last_successful_sync_at` advanced to **02:41:06**, and `last_cloud_check_at` to **02:41:07**, October 31. Older excluded events and failed-run audit history remain retained. They were not falsely acknowledged or requeued outside the past-hour rule.

All **32** targeted sync tests passed, plus lint. The new regression reproduces the exact variant sort-order conflict, verifies a single `PT409` failure with no upload timestamp advance, preserves the durable batch and cloud row, then confirms safe retry after explicit reconciliation. Existing tests continue to cover lost replies, duplicate prevention, bigint IDs, atomic rollback, source/version protection, partial success, and the past-hour scope.

Before/after receiver definitions, the variant snapshot, a full local sync-schema backup, and live receipt verification are retained in Git-ignored `supabase/backups/20261031-*.local` files, excluded from Docker build contexts.
