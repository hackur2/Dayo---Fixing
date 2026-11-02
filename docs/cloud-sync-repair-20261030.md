# Cloud sync repair — October 30, 2026

## Confirmed failures

- The worker repeatedly submitted one 24,359-record baseline, approximately 9.2 MB. A real retry was aborted at 20,024 ms by the hardcoded client timeout, before an HTTP response.
- A second authorized retry with a bounded longer timeout returned HTTP 500 / PostgreSQL `57014`, `canceling statement due to statement timeout`, after 36,901 ms. Cloud `service_role` had no explicit timeout and inherited the authenticator limit. Authentication and the receiver were present.
- Receiver code repeatedly queried table catalogs for individual rows. It now caches those definitions once per table while retaining ownership/conflict checks, foreign-key validation, generated-value verification, and durable batch receipts.
- Local lacked five optional archive/expiry columns present in cloud. These were added without enabling expiry clearing. Canonical unit conversion preserved physical stock, per-physical-unit cost, expiry dates and existing business timestamps; its maintenance writes were excluded from capture.
- Cloud already had 6,009 independently seeded demo orders with different IDs. Older cloud/local inventory quantities and expiry states also differed. Those historic conflicts were **not reconciled or uploaded**, following the subsequent instruction to sync only the past hour.

## Active scope

The user superseded the year-wide upload request with **only records registered within the past hour**. `sync_window_seconds` is 3600. The worker was stopped while that rule was installed.

All 24,359 historical record statuses are now `deferred`, not falsely marked uploaded. The original batch ID, payload, event versions, attempts and error history remain preserved; its batch is superseded and cannot be retried automatically. No replacement was needed because zero records qualified.

Fresh sales are filtered using the order creation time; their items and deduction markers follow the parent order. Stock movements and feedback use creation time; live inventory/menu changes use recorded update time. Imported undated baseline lookups do not become recent merely because they were queued recently.

## Timestamp/status behavior

- A non-empty confirmed and locally acknowledged batch advances `last_successful_sync_at`.
- A successful zero-record check advances only `last_cloud_check_at`.
- Error codes and actionable reasons are retained for active failures; a timeout is no longer mislabeled as a generic connection problem.
- Counts distinguish current-run confirmations, eligible pending/failed rows, and older excluded rows.
- The upload request has a configurable bounded 180-second default; only the service-only receiver has a 90-second SQL timeout. Browser query limits remain unchanged.

## Verification

31 automated checks passed, including failed retries, lost responses, duplicate prevention, exact bigint IDs, transaction rollback, source-version protection, zero-record timestamps, partial success followed by failure, and filtering a mixed historical batch without rewriting its original payload.

Both the worker and LAN frontend were rebuilt and restarted. A live cloud API check completed successfully with zero uploaded/failed records. Cloud order count stayed 6,086, including the same 6,009 demo orders; the new receipt confirmed zero business records. No new business records were fabricated for testing.

The successful-upload timestamp remains empty until a genuinely eligible record is uploaded; the successful-cloud-check timestamp shows the verified connection. This is intentional and is not a fabricated successful upload.

Business and queue backups are retained under `supabase/backups/*.sql.local`, ignored by Git and excluded from future Docker build contexts. Older excluded records require explicit reconciliation before any later decision to widen the sync window.

Timeout configuration follows the official [Supabase timeout guidance](https://supabase.com/docs/guides/database/postgres/timeouts) and [PostgREST function-scoped settings](https://docs.postgrest.org/en/stable/references/transactions.html#hoisted-function-settings).
