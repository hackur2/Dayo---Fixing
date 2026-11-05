# Change log

Append entries; do not rewrite completed history. Times use ISO 8601 with an explicit zone.
Source paths are relative to kb. A source snapshot's original location is recorded in memory.json.
Start each entry with a heading `## [time] action | title`. The action is intake, compile, query, maintenance, audit or change.

## [2026-11-06T00:53:38+08:00] change | DaYo repository context and agent rules

- Integrated the existing snippet into root `AGENTS.md` and consolidated maintenance under `docs/kb/`. Kept the previous wiki paths as entry points and its initial log as history.
- Reviewed routes, services, current migrations, local setup, deployment, and test fixtures. Filed five source-linked topics and the [scan report](outputs/2026-11-06-project-context-and-agent-rules.md).
- Recorded superseded setup references and local test failures in the [verification map](wiki/verification.md). Repository files serve as direct evidence. No raw sources were received or compiled.
- Ran the maintenance tests and refreshed and checked generated navigation.

## [2026-11-06T00:58:22+08:00] maintenance | Prepare wiki for repository publication

- Distinguished scan-time worktree findings from files in the documentation commit. The cloud KDS draft is recorded by path so the published wiki works without that local migration.

## [2026-11-06T01:06:42+08:00] query | Local database replacement of cloud data

- Reviewed the current sync receiver, worker, local setup, and runbook. Filed the [replacement-sync assessment](outputs/2026-11-06-local-to-cloud-replacement-sync.md).
- Documented that the dashboard upload cannot delete cloud data and protects independently changed cloud rows; a local-to-cloud replacement requires an explicitly authorized, backed-up administrative handoff.

## [2026-11-06T01:21:15+08:00] query | Local and cloud dashboard comparison

- Filed the [dashboard comparison](outputs/2026-11-06-local-cloud-dashboard-comparison.md). Used aggregate values from the owner’s screenshot and reviewed the dashboard calculation and sync timestamps against the worktree.

## [2026-11-06T01:22:55+08:00] maintenance | Refresh dashboard comparison references

- Corrected relative source links in the comparison and earlier sync assessment. Refreshed the output register and verified the knowledge base.

## [2026-11-06T01:26:15+08:00] query | Local and cloud inventory comparison

- Filed the [inventory comparison](outputs/2026-11-06-local-cloud-inventory-comparison.md) and verified its two SQL statements in a read-only transaction on a PostgreSQL-compatible fixture.

## [2026-11-06T01:26:15+08:00] maintenance | Refresh inventory comparison references

- Regenerated wiki navigation and verified the output review and evidence links.

## [2026-11-06T01:30:04+08:00] query | Review ingredient query results

- Recorded the [observed ingredient differences](outputs/2026-11-06-ingredient-query-results.md) and the effect of unset local unit costs on a cloud replacement.

## [2026-11-06T01:30:04+08:00] maintenance | Refresh ingredient results register

- Regenerated the output register and verified its links and review state.

## [2026-11-06T01:31:25+08:00] query | Review supplier query results

- Recorded the [supplier counts](outputs/2026-11-06-supplier-query-results.md) and how cloud-only rows would be affected by replacement.

## [2026-11-06T01:31:25+08:00] maintenance | Refresh supplier results register

- Regenerated the output register and verified its links and review state.

## [2026-11-06T01:39:21+08:00] query | Prepare one-time cloud-to-local copy

- Recorded the owner’s change of direction for this copy. Prepared the [SQL Editor procedure](outputs/2026-11-06-cloud-to-local-copy.md) and tested both scripts on fixtures with the DaYo business migrations. Neither live database was contacted.

## [2026-11-06T01:39:21+08:00] maintenance | Refresh the cloud-to-local procedure links

- Regenerated wiki navigation and verified the output review and evidence links.

## [2026-11-06T01:52:57+08:00] query | Verify the local cloud snapshot import

- Matched the owner-provided local results to counts and completed revenue from the checksum-verified cloud snapshot. Recorded the [verification](outputs/2026-11-06-cloud-to-local-verification.md) without retaining source records in the repository.

## [2026-11-06T01:52:57+08:00] maintenance | Refresh import verification links

- Regenerated wiki navigation and verified the output review and evidence links.

## [2026-11-06T01:55:50+08:00] query | Review startup after the cloud-to-local import

- Recorded the [restart check](outputs/2026-11-06-cloud-sync-restart-check.md) for the current outbox and unfinished batches. Separated connectivity verification from acceptance of future local edits.

## [2026-11-06T01:55:50+08:00] maintenance | Refresh the restart check references

- Regenerated wiki navigation and verified the restart check links and review state.

## [2026-11-06T02:02:10+08:00] query | Review cloud menu edit direction

- Filed the [menu sync direction](outputs/2026-11-06-cloud-menu-edit-direction.md) and verified the outbound menu path and inbound order scope in the worktree.

## [2026-11-06T02:02:10+08:00] maintenance | Refresh menu sync references

- Regenerated wiki navigation and verified the menu sync references.

## [2026-11-06T02:04:16+08:00] query | Local-first operation and inbound cloud sync

- Filed the [assessment](outputs/2026-11-06-local-first-and-cloud-pull.md) using the original local-first paper and DaYo source evidence. Distinguished the architecture from a live offline test.

## [2026-11-06T02:04:16+08:00] maintenance | Refresh local-first references

- Regenerated wiki navigation and verified the assessment links and review state.

## [2026-11-06T02:09:43+08:00] query | Cloud dashboard while Docker is off

- Filed the [design assessment](outputs/2026-11-06-cloud-dashboard-docker-off.md). Compared hosted dashboard access, the QR heartbeat rule, and durable cloud-to-local catch-up against repository evidence.

## [2026-11-06T02:09:43+08:00] maintenance | Refresh cloud dashboard references

- Regenerated wiki navigation and verified the design assessment links and review state.

## [2026-11-06T02:13:29+08:00] query | Hosted route access scope

- Filed the [cloud access assessment](outputs/2026-11-06-cloud-route-access-scope.md) after checking the route guards, SPA fallback, staff permissions, and QR grants.

## [2026-11-06T02:13:29+08:00] maintenance | Refresh cloud route references

- Regenerated wiki navigation and verified the cloud route assessment links.

## [2026-11-06T02:19:19+08:00] query | Order Taker naming

- Filed the [naming assessment](outputs/2026-11-06-order-taker-naming.md) after checking the source field, writer, display label, and report filters.

## [2026-11-06T02:19:19+08:00] maintenance | Refresh Order Taker naming references

- Regenerated wiki navigation and verified the assessment links.

## [2026-11-06T02:28:26+08:00] change | Prepare Manual Order Taker source

- Prepared the source migration and report compatibility. Verified the focused suite and production build, and recorded the [rollout and limits](outputs/2026-11-06-manual-order-taker-source-change.md). Live deployment remains pending.

## [2026-11-06T02:28:26+08:00] maintenance | Refresh Manual Order Taker references

- Verified the knowledge base and passed ESLint for the changed JavaScript and tests.

## [2026-11-06T03:00:00+08:00] change | Prepare staff login and page access

- Prepared Staff Monitor provisioning, selected Admin page access, route/RLS checks, and the [implementation report](outputs/2026-11-06-staff-login-access-change.md). Local and cloud rollout remain pending.
