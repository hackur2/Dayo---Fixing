# Verification and source map

Updated 2026-11-06. Commands run from the repository root unless noted.

## Verification entry points

| Area | Local command or reference |
| --- | --- |
| Frontend lint | `npm run lint`, with the React/JS rules in [eslint.config.js](../../../eslint.config.js). |
| Full local regression suite | `node --test --test-concurrency=1 'tests/*.test.mjs'`. Tests include pure helpers, mocked services, and in-memory PostgreSQL-compatible fixtures. Serial execution avoids Vite's shared test WebSocket port. |
| Sync | The [sync runbook](../../../sync/README.md#verification) lists the focused integration, service, and diagnostics suite. |
| Knowledge base | `python -B docs/kb/tools/test_maintain.py`, then `python -B docs/kb/tools/maintain.py refresh` and `python -B docs/kb/tools/maintain.py check`. |
| Browser and deployed database | Use the [frontend verification checklist](../../frontend-testing-checklist.md) for scenario coverage and this page's migration map for current setup. Record the environment and whether each scenario actually ran. |

## Observed on the 2026-11-06 worktree

- `node --test 'tests/*.test.mjs'` reported 241 passes and two failures across 243 results. One stock-completion subtest and its parent suite failed because the minimal sync fixture had no `ingredients.archived_at` column required by an uncommitted trigger change in `20261030000003_safe_cloud_sync.sql`. The serial sync suite reproduced the error. The compatibility migration adds the column to an older database schema. [Fixture](../../../tests/cloudSync.test.mjs#L22) · [Compatibility migration](../../../supabase/migrations/20261030000006_sync_schema_compatibility.sql)
- `npm run lint` reported seven errors and three warnings in existing React components and hooks. Findings include render purity, state updates in effects, and effect dependencies. [KDS card](../../../src/components/admin/KdsOrderCard.jsx) · [Customer status hook](../../../src/hooks/useCurrentOrderData.js) · [Staff shifts page](../../../src/pages/superAdmin/SuperAdminStaffShiftsPage.jsx)
- An in-memory smoke check loaded the schema baseline and availability migration. It exercised anonymous QR session creation, menu availability, rejection with ordering off, database pricing when enabled, and one-time recipe deduction. This verifies SQL functions with test stubs. PostgREST, browser interaction, and live deployments remain unverified.

## Where earlier documentation differs

| Earlier reference | Current repository evidence |
| --- | --- |
| The [root README](../../../README.md), [workflow notes](../../system-workflows.md), and [frontend checklist](../../frontend-testing-checklist.md) name separate early setup, QR, and completion migrations. | Those filenames are absent. The [schema baseline](../../../supabase/migrations/20261020143115_remote_schema.sql) contains core tables, QR/POS RPCs, and the completion trigger. The [stock-only expiry](../../../supabase/migrations/20261029000001_expiry_stock_only.sql) and [safe sync](../../../supabase/migrations/20261030000003_safe_cloud_sync.sql) migrations update that trigger. |
| The [root README](../../../README.md#menu-image-storage) references an older image migration name, and the [frontend architecture notes](../../frontend-architecture.md#current-limitations) describe data URLs and a removed AI chat. | The current [image migration](../../../supabase/migrations/20261020143116_menu_image_storage.sql), [image picker](../../../src/components/superAdmin/inventory/MenuImagePicker.jsx), and [Gemini service](../../../src/services/aiAssistantService.js) implement Storage uploads and a configured browser assistant. |
| The [root Docker instructions](../../../README.md#run-with-docker) name a root env template and default Compose path. | The checked-in [Compose file](../../../docker/docker-compose.yml) and [local environment template](../../../docker/.env.docker.local.example) are under `docker/`. |
| The [sync runbook](../../../sync/README.md#record-and-transaction-rules) describes one-way mirroring in the outbound conflict rules. | The scan found a separate active-order KDS pull in uncommitted changes. See [deployment and sync](deployment-and-sync.md#online-availability-and-cloud-kds) for the scope and verification gaps. |

## Related topics

- [System overview](system-overview.md)
- [Inventory and reporting](inventory-and-reporting.md)
- [Deployment and sync](deployment-and-sync.md)

<!-- kb:backlinks:start -->
## Backlinks

- [Deployment and sync](deployment-and-sync.md)
- [Wiki index](index.md)
- [Inventory and reporting](inventory-and-reporting.md)
- [Saved answers and wiki contributions](outputs.md)
- [System overview](system-overview.md)
<!-- kb:backlinks:end -->
