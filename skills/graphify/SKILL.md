---
name: graphify
description: >
  Queryable codebase knowledge graph for AI coding agents. Extracts AST, relationships,
  and call graphs from source code so agents navigate by graph instead of grepping
  blindly. Use whenever you need to understand an unfamiliar repo, trace a call flow,
  find what connects two components, understand architecture before making changes,
  debug a cross-module issue, or onboard to a new project.
---

# Graphify

Gives AI coding agents a queryable knowledge graph of the entire project — code, SQL schemas, docs, PDFs, images — so agents navigate by graph instead of grepping through files blindly.

## When to use

- Exploring an unfamiliar repo — understand the architecture before making changes
- Tracing a call flow or data flow across modules
- Finding what connects two components or what depends on something
- Debugging a cross-module issue
- Onboarding to a new project
- Before writing, refactoring, or reviewing code in a repo that has `graphify-out/`
- When a task mentions "graph the code", "map the project", "what depends on X", "where is Y called", or "understand the codebase"

## When not to use

- Simple single-file edits where no cross-module context is needed
- The task is about fixing a stale or incorrect graph output
- The user explicitly says not to use it
- `$GRAPHIFY_OUT/graph.json` does not exist (notify team to rebuild rather than skipping silently)

## Company-Wide Shared DB

All engineering agents use a **single shared graphify database** covering all company projects.

```
GRAPHIFY_OUT=/home/vladimir/.paperclip/instances/default/projects/bf21afba-af57-4c47-8e4e-3f7f1904908c/2f763afb-3b7a-4b76-bfff-f6e735c352ba/_default/graphify-out
```

Always use this absolute path. Never use a relative `graphify-out/` or a per-project local output. The DB covers all projects: `backoffice`, `infrastructure`, `utms`, and docs.

## Quick Reference

```bash
GRAPHIFY_OUT=/home/vladimir/.paperclip/instances/default/projects/bf21afba-af57-4c47-8e4e-3f7f1904908c/2f763afb-3b7a-4b76-bfff-f6e735c352ba/_default/graphify-out

graphify query "what connects X to Y?" --graph $GRAPHIFY_OUT/graph.json
graphify path "ComponentA" "ComponentB" --graph $GRAPHIFY_OUT/graph.json
graphify explain "ClassName" --graph $GRAPHIFY_OUT/graph.json
graphify export callflow-html     # Mermaid architecture page
```

Output lives in the company-wide `graphify-out/`:
```
$GRAPHIFY_OUT/
├── graph.html       # interactive browser view
├── GRAPH_REPORT.md  # key concepts, surprising connections, suggested questions
└── graph.json       # full graph — query without re-reading files
```

## Agent Pipeline

```
Coding task arrives
    ↓
[Phase 1] CHECK — does $GRAPHIFY_OUT/graph.json exist?
    ├── YES → query graph for task context
    └── NO  → notify CTO to rebuild; proceed without graph
    ↓
Agent receives task + graph context
    ↓
Agent writes / edits / reviews code
    ↓
[Phase 2] UPDATE — if files were added or significantly changed
    └── run graphify from _default root to keep graph current
```

## Phase 1 — Pre-Task Graph Query

Before writing any code, orient yourself using the graph.

### Step 1 — Check graph freshness

```bash
GRAPHIFY_OUT=/home/vladimir/.paperclip/instances/default/projects/bf21afba-af57-4c47-8e4e-3f7f1904908c/2f763afb-3b7a-4b76-bfff-f6e735c352ba/_default/graphify-out
ls $GRAPHIFY_OUT/graph.json 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

- **Missing** → notify team to rebuild; proceed without graph context
- **Exists but stale** (repo changed significantly) → run full rebuild from `_default` root (see Building the Graph)
- **Fresh** → proceed to query

### Step 2 — Choose the right query

```bash
GRAPHIFY_OUT=/home/vladimir/.paperclip/instances/default/projects/bf21afba-af57-4c47-8e4e-3f7f1904908c/2f763afb-3b7a-4b76-bfff-f6e735c352ba/_default/graphify-out
```

| Task type | Query to run |
|-----------|-------------|
| Understand a component | `graphify explain "ComponentName" --graph $GRAPHIFY_OUT/graph.json` |
| Trace a data flow | `graphify query "how does X flow to Y?" --graph $GRAPHIFY_OUT/graph.json` |
| Find dependencies | `graphify query "what depends on X?" --graph $GRAPHIFY_OUT/graph.json` |
| Debug a connection | `graphify path "SourceNode" "TargetNode" --graph $GRAPHIFY_OUT/graph.json` |
| General orientation | Read `$GRAPHIFY_OUT/GRAPH_REPORT.md` — God Nodes section |

### Step 3 — Inject context into the coding task

Structure the agent's working context as:

```
## Graph Context
<query result or relevant GRAPH_REPORT.md sections>

### God Nodes (most connected — likely touched by this task)
<list from report>

### Relevant Connections
<path or explain output>

---
## Task
<original coding task>
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

### Build (company-wide — always run from _default root)

The company DB is built by running graphify from the **company `_default` root** so all projects are covered in one pass:

```bash
COMPANY_ROOT=/home/vladimir/.paperclip/instances/default/projects/bf21afba-af57-4c47-8e4e-3f7f1904908c/2f763afb-3b7a-4b76-bfff-f6e735c352ba/_default

# Full build of all company projects
cd $COMPANY_ROOT && graphify . --no-viz

# Build with extras (if project has PDFs, office docs, SQL schemas)
pip install "graphifyy[pdf,office,sql]"
cd $COMPANY_ROOT && graphify .

# Deep mode — more aggressive relationship extraction
cd $COMPANY_ROOT && graphify . --mode deep
```

This writes the unified graph to `$COMPANY_ROOT/graphify-out/` covering all subprojects.

A `.graphifyignore` file at `$COMPANY_ROOT` controls what gets excluded (e.g. `utms-worktrees/`, `graphify-out/`).

### Incremental update (after code changes)

```bash
COMPANY_ROOT=/home/vladimir/.paperclip/instances/default/projects/bf21afba-af57-4c47-8e4e-3f7f1904908c/2f763afb-3b7a-4b76-bfff-f6e735c352ba/_default
cd $COMPANY_ROOT && graphify . --update
```

Use `--update` for routine coding tasks. Reserve full rebuild for:
- Major refactors that deleted/renamed many files
- First run after setting up the company DB
- Ghost duplicate nodes (run `graphify extract . --force` to clean)

## Phase 2 — Post-Task Graph Update

After completing a coding task, update the graph if:
- New files were created
- Existing files had significant structural changes (new classes, functions, imports)
- A module was deleted or renamed

```bash
COMPANY_ROOT=/home/vladimir/.paperclip/instances/default/projects/bf21afba-af57-4c47-8e4e-3f7f1904908c/2f763afb-3b7a-4b76-bfff-f6e735c352ba/_default
cd $COMPANY_ROOT && graphify . --update
```

For minor edits (bug fixes, docstrings, variable renames) — skip the update.

## Query Cheatsheet

```bash
GRAPHIFY_OUT=/home/vladimir/.paperclip/instances/default/projects/bf21afba-af57-4c47-8e4e-3f7f1904908c/2f763afb-3b7a-4b76-bfff-f6e735c352ba/_default/graphify-out

# Understand a specific class or function
graphify explain "AuthMiddleware" --graph $GRAPHIFY_OUT/graph.json

# Find the shortest connection between two things
graphify path "UserService" "DatabasePool" --graph $GRAPHIFY_OUT/graph.json

# Ask natural language questions about architecture
graphify query "what connects the cache layer to the API routes?" --graph $GRAPHIFY_OUT/graph.json
graphify query "which modules import from utils?" --graph $GRAPHIFY_OUT/graph.json
graphify query "where is the rate limiter applied?" --graph $GRAPHIFY_OUT/graph.json

# Deep search with larger budget
graphify query "trace the auth flow from request to token validation" --dfs --budget 2000 --graph $GRAPHIFY_OUT/graph.json

# Export a readable architecture page
graphify export callflow-html
```

## File Types the Graph Covers

| Type | What's extracted |
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

## Reading the Graph Report

`graphify-out/GRAPH_REPORT.md` always contains:

- **God Nodes** — highest-connectivity concepts. Any non-trivial task likely touches these.
- **Surprising connections** — links across modules that aren't obvious from file structure.
- **The "why"** — inline `# NOTE:`, `# WHY:`, `# HACK:` comments extracted as graph nodes.
- **Suggested questions** — 4–5 questions the graph can answer that grep cannot.
- **Confidence tags** — `EXTRACTED` (found in code) vs `INFERRED` (model-guessed) vs `AMBIGUOUS`.

Always check confidence tags before acting on a relationship — `AMBIGUOUS` links need manual verification before assuming they're real.

## Team Setup

The company-wide DB lives at a fixed shared path — all agents read and write from the same location. No per-project `graphify-out/` directories.

```
GRAPHIFY_OUT=/home/vladimir/.paperclip/instances/default/projects/bf21afba-af57-4c47-8e4e-3f7f1904908c/2f763afb-3b7a-4b76-bfff-f6e735c352ba/_default/graphify-out
```

To exclude unwanted paths from the full scan, add a `.graphifyignore` at the `_default` root:
```
utms-worktrees/
graphify-out/
```

Auto-rebuild on every commit (AST only, no API cost):
```bash
cd /home/vladimir/.paperclip/instances/default/projects/bf21afba-af57-4c47-8e4e-3f7f1904908c/2f763afb-3b7a-4b76-bfff-f6e735c352ba/_default
graphify hook install
```

This installs a git merge driver for conflict-free `graph.json` union-merging.

## Integration with LightRAG

When Graphify is used alongside LightRAG:

- **Graphify** handles **code structure** — call graph, dependency map, architecture
- **LightRAG** handles **project knowledge** — ADRs, specs, decisions, docs, and institutional context

A coding agent should query both before acting on a task:
1. Query LightRAG for documented decisions/context about the feature
2. Query Graphify for the current code structure relevant to that feature
3. Proceed with the task armed with both knowledge layers

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

1. **Never skip Phase 1** for tasks touching more than one module. The graph reveals connections invisible from file structure alone.
2. **Prefer `--update` over full rebuild** during active coding sessions.
3. **God Nodes are your anchor.** If a task touches a God Node, assume wide blast radius and query for all dependents.
4. **Code extraction is local and free** (tree-sitter AST, no API). Doc/PDF extraction costs API tokens. Batch doc extraction separately when token budget is tight.
5. Dirty `graphify-out/` files are expected after hooks or incremental updates. Dirty graph files are not a reason to skip graphify.
