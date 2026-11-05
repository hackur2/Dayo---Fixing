# DaYo project context and agent rules

Date 2026-11-06. Evidence reviewed by the assistant. Human review is pending.

## Request and decision

Scan the DaYo repository, follow its knowledge base workflow, and integrate the current agent rules. The checkout had no root or ancestor `AGENT.md` or `AGENTS.md`. The existing [agent snippet](../../AGENTS-snippet.md) supplied the rules for the root [AGENTS.md](../../../AGENTS.md). The maintained wiki lives in `docs/kb/` so its existing hash manifest, reviewed outputs, and generated navigation work together. Earlier wiki entry paths lead to the corresponding current pages.

## Findings

- The [system overview](../wiki/system-overview.md) maps the React/Vite frontend, Supabase ownership, roles, and the separate sync worker.
- [Ordering and access](../wiki/ordering-and-access.md) records the fixed QR flow, database price calculation, KDS/POS, menu-image uploads, and the configured browser Gemini assistant. [Schema baseline](../../../supabase/migrations/20261020143115_remote_schema.sql) · [Image picker](../../../src/components/superAdmin/inventory/MenuImagePicker.jsx) · [Gemini service](../../../src/services/aiAssistantService.js)
- [Inventory and reporting](../wiki/inventory-and-reporting.md) distinguishes completion deductions, stock-only expiry, manual archive, supplier records, and Philippine date-based reports. [Stock-only expiry](../../../supabase/migrations/20261029000001_expiry_stock_only.sql) · [Inventory service](../../../src/services/inventoryService.js) · [Dashboard service](../../../src/services/dashboardService.js)
- [Deployment and sync](../wiki/deployment-and-sync.md) covers the local/cloud split, outbox window, conflict and receipt rules, online ordering heartbeat, and the active cloud-order pull present in the worktree. [Local setup](../../../supabase/snippets/cloud_sync_local_setup.sql) · [Sync runbook](../../../sync/README.md) · [Worker](../../../sync/worker.mjs)

## Verification and limits

The full local Node suite reported 241 passes and two failures from one sync test fixture missing `archived_at`. The serial sync suite reproduced the same error. Lint reported seven errors and three warnings in existing frontend files. All 15 wiki maintenance tests passed, and the wiki checks found no broken links or orphan pages. The [verification map](../wiki/verification.md) links the fixture, trigger, and affected documentation. The review used repository files and local fixtures. Live database migrations, browser flows, and deployments were outside the scan.
