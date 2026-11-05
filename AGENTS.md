# DaYo repository instructions

## Project context

Start with the [wiki index](docs/kb/wiki/index.md) and follow the relevant topic pages to their source files. DaYo is a React/Vite ordering and inventory app backed by Supabase. Confirm consequential behavior in the current code, migrations, or tests, and distinguish the working tree from what has been deployed.

Use the [knowledge base manual](docs/KB.md) for knowledge work. Before writing to the wiki, read the [session memory](docs/kb/memory.md), [processing manifest](docs/kb/memory.json), and recent [change-log entries](docs/kb/change-log.md).

## Knowledge base workflow

- Keep the knowledge base under `docs/kb/`. Treat source documents as evidence. Keep raw source bytes, append-only logs, and human edits intact. Keep credentials, QR tokens, private personal data, and production exports out of the wiki.
- **Intake.** Save new raw inputs under `docs/kb/raw/`, record their SHA-256 hashes in the manifest, and log the intake. Compile raw inputs only when the owner asks.
- **Compile.** Check current hashes throughout the raw tree. After validation, move completed current versions to `docs/kb/raw/processed/` without overwriting destinations. Verify hashes, update references and manifest paths, and record old and new paths in `source_relocations`.
- **Query.** For knowledge questions, save a dated, evidence-linked report in `docs/kb/outputs/` before replying and record its review in the manifest. File supported findings in the relevant topic pages.
- **Application changes.** Record user-facing changes in the application changelog and save a dated report under `docs/kb/outputs/`. File the report in the matching topic, record the verification performed, and distinguish prepared changes from confirmed deployments.
- **Maintenance.** For sessions that change the project, append to `docs/kb/change-log.md` and update `docs/kb/memory.md`. After wiki edits, run the commands below from the repository root. Keep authored text outside generated `kb:` marker sections.

```powershell
python -B docs/kb/tools/maintain.py refresh
python -B docs/kb/tools/maintain.py check
```

## Working boundaries

- Preserve unrelated worktree edits. Read the current migration chain in filename order and check local-only snippets separately. Keep service-role keys and database connection strings server-side.
- Keep documentation and code verification separate from live operations. Database resets, data changes, cloud migration pushes, and deployments need an owner request covering that action.
- Run focused tests for the area you change. See [verification and source map](docs/kb/wiki/verification.md) for commands and evidence levels.
