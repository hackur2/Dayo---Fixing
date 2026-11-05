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
