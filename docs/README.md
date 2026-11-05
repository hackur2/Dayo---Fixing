# DaYo documentation

Start with the [engineering wiki](kb/wiki/index.md) for current project context and the [knowledge base manual](KB.md) for intake, compilation, saved answers, and maintenance. The [root agent instructions](../AGENTS.md) tell coding assistants how to use both.

## Project references

- [Repository README](../README.md) and [sync runbook](../sync/README.md) describe setup and operations.
- The [verification map](kb/wiki/verification.md) identifies current migration files, available tests, and differences from older documentation.
- [Source catalog](kb/wiki/sources.md), [saved reports](kb/wiki/outputs.md), and [change log](kb/change-log.md) track knowledge work.
- The [earlier wiki entry point](knowledge-base/README.md) leads to the maintained wiki and its initial log.

The knowledge base uses plain Markdown and a Python standard-library maintenance tool. From the repository root, run:

```powershell
python -B docs/kb/tools/test_maintain.py
python -B docs/kb/tools/maintain.py refresh
python -B docs/kb/tools/maintain.py check
```

The setup adapts Andrej Karpathy's LLM Wiki pattern and the SoCim `brian` starter kit. SoCim supplied the hash records, source archive, output reviews, evidence labels, and maintenance tool. [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) · [Original agent rules](AGENTS-snippet.md)
