---
name: graphify-update
description: >
  Build or update the codebase knowledge graph. Extracts AST, relationships,
  and call graphs from source code. Use after cloning a repo, after major refactors,
  or after merging code to main branch. WRITE skill — modifies graphify-out/.
---

# Graphify Update

Build or update the code graph. This skill modifies `graphify-out/` — use `graphify-query` for read-only operations.

## Hard Rules

> **1. NEVER graphify Paperclip itself.**
> Graphify runs on **project** code only (e.g. UTMS, backoffice, infrastructure). Paperclip is the infrastructure the agents run on, not a project to analyse. If the target repo is the Paperclip checkout, stop and say so.

> **2. `graphify-out/` lives at the shared projects root only.**
> Single `graphify-out/` at `/home/vladimir/projects/Projects/paperclip-projects/graphify-out/`.
> Never create `graphify-out/` in individual project directories or subdirectories of the paperclip repo.
> Never commit `graphify-out/` files to git — they are local generated output.

Why rule 2 is absolute: a single branch once carried **536 committed `graphify-out/` files** around 8 real deliverables, making the branch unreviewable and burying the actual work. Generated graphs also churn on every run, so committing them produces enormous meaningless diffs and merge conflicts.

If you find `graphify-out/` inside a repo or subdirectory, treat it as cleanup: remove it from tracking. Do not "refresh and commit" it — that instruction, wherever it appears in older task descriptions, is superseded by this rule.

## When to use

- After cloning a repo for the first time
- After a major refactor that deleted/renamed many files
- After merging code to the main branch
- When the graph is missing or severely stale
- When `graphify-query` reports "Graph does not exist"

## When NOT to use

- During active coding tasks on feature branches (use `graphify-query` instead)
- The user explicitly says not to use it
- The graph is already fresh and you are only querying (use `graphify-query`)

## Quick Reference

```bash
graphify .                        # build or rebuild the full graph
graphify . --update               # refresh only changed files (fast)
```

Output lives in `graphify-out/`:
```
graphify-out/
├── graph.html       # interactive browser view
├── GRAPH_REPORT.md  # key concepts, surprising connections, suggested questions
└── graph.json       # full graph — query without re-reading files
```

## Agent Pipeline

```
Coding task arrives
    |
[Phase 1] CHECK — does graphify-out/graph.json exist?
    |-- YES -> use graphify-query for read-only operations
    |-- NO  -> use this skill to build, then switch to graphify-query
    |
Agent receives task + graph context
    |
Agent writes / edits / reviews code
    |
[Phase 2] UPDATE — after merge to main
    |-- use this skill to run graphify . --update
```

## Building the Graph

### Install (one-time)

```bash
# Recommended
uv tool install graphifyy

# Alternatives
pipx install graphifyy
pip install graphifyy
```

### Build

```bash
# Full build
graphify .

# Build with extras (if project has PDFs, office docs, SQL schemas)
pip install "graphifyy[pdf,office,sql]"
graphify .

# Skip HTML viz for speed (CI/headless)
graphify . --no-viz

# Deep mode — more aggressive relationship extraction
graphify . --mode deep
```

### Incremental update (after code changes)

```bash
graphify . --update
```

Use `--update` for routine coding tasks. Reserve full rebuild for:
- Major refactors that deleted/renamed many files
- First run after cloning the repo
- Ghost duplicate nodes (run `graphify extract . --force` to clean)

## Post-Merge Graph Update

After a git merge to main:
```bash
cd /home/vladimir/projects/Projects/paperclip-projects
graphify . --update
```

This ensures the graph reflects the consolidated state of the codebase, not intermediate feature branch states.

## File Types the Graph Covers

| Type | What is extracted |
|------|-----------------|
| Code (31 languages: `.py .ts .js .go .rs .java` etc.) | AST — functions, classes, imports, call graphs. Processed locally, no API call. |
| Docs (`.md .mdx .yaml .html .txt`) | Semantic concepts, decisions, rationale |
| SQL schemas | Tables, relationships, foreign keys (requires `graphifyy[sql]`) |
| PDFs | Semantic extraction (requires `graphifyy[pdf]`) |
| Office docs (`.docx .xlsx`) | Content extraction (requires `graphifyy[office]`) |
| Images | Visual description via model API |

Exclude paths via `.graphifyignore` (same syntax as `.gitignore`):
```
node_modules/
dist/
*.generated.py
```

## Team Setup

`graphify-out/` lives at the shared projects root only (`/home/vladimir/projects/Projects/paperclip-projects/graphify-out/`).
It is NOT committed to git — it is local generated output.

To rebuild after a merge:
```bash
cd /home/vladimir/projects/Projects/paperclip-projects
graphify . --update
```

This also installs a git merge driver for conflict-free `graph.json` union-merging.

## Failure Modes

| Failure | Action |
|---------|--------|
| `graphify: command not found` | Use `uv tool install graphifyy` or `pipx install graphifyy` |
| Graph has fewer nodes after rebuild | Run `graphify extract . --force` |
| Ghost duplicate nodes | Run `graphify extract . --force` to clean |
| Extraction empty for docs/PDFs | Ensure `ANTHROPIC_API_KEY` (or relevant key) is set |
| Graph too large for browser | Use `--no-viz` and query via CLI or MCP server |

## Configuration Reference

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude backend for doc/PDF extraction |
| `GRAPHIFY_MAX_WORKERS` | AST parallelism thread count |
| `GRAPHIFY_MAX_OUTPUT_TOKENS` | Raise output cap for dense files (e.g. `32768`) |
| `GRAPHIFY_FORCE` | Force rebuild even with fewer nodes |

## Hard Rules

1. **Prefer `--update` over full rebuild** during active coding sessions.
2. **Code extraction is local and free** (tree-sitter AST, no API). Doc/PDF extraction costs API tokens. Batch doc extraction separately when token budget is tight.
3. Dirty `graphify-out/` files are expected after hooks or incremental updates. Dirty graph files are not a reason to skip graphify.
4. **This skill WRITEs to `graphify-out/`.** For read-only operations, use `graphify-query`.
