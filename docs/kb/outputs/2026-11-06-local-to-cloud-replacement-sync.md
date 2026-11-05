# Replacing cloud data with the local database

Date: 2026-11-06T01:06:42+08:00  
Status: reviewed and filed by assistant; human review pending.

## Question

Can data currently in the cloud (described by the owner as Claude data) be removed, then replaced by the local database through **Sync to Cloud**?

## Conclusion

Yes, but it is a deliberate database handoff, not what the Sync button does by itself. The button uploads eligible local INSERT/UPDATE snapshots through the local worker; it never issues cloud DELETE operations. It also protects a cloud row that differs from the prior local-sourced value, returning a conflict instead of overwriting it.

To make local data the cloud copy, first take a verified cloud backup and stop the sync worker. An authorized administrator must then clear or otherwise explicitly reconcile the in-scope cloud business rows *and* the related `cloud_sync` ownership/receipt metadata as one planned operation. Next, ensure the local setup has queued a current baseline and that its records fall within the configured 3,600-second window (or use an explicitly reviewed baseline procedure). Restart the worker, request the manual sync as a local Super Admin, and inspect the run status plus cloud row counts before treating the replacement as complete. The exact tables and retention requirements must be chosen before any destructive action; auth users, profiles, QR secrets, Storage files, and credentials are outside sync scope.

## Evidence

- [Sync runbook](../../../sync/README.md#current-scope-the-past-hour): outbound work is limited to a configurable 3,600-second window; older work becomes `deferred`.
- [Local setup](../../../supabase/snippets/cloud_sync_local_setup.sql): it queues a one-time local baseline only when `baseline_queued` is false; local DELETE events are marked skipped.
- [Cloud receiver](../../../supabase/migrations/20261030000003_safe_cloud_sync.sql): only INSERT and UPDATE events are accepted; independently changed cloud records create a conflict.
- [Sync engine](../../../sync/engine.mjs): the worker calls the protected receiver and keeps failed local rows queued.

## Limits

This was a code review only. It did not connect to either database, back up, delete, modify sync metadata, or run a synchronization. Deployment configuration and actual cloud contents remain unknown.

