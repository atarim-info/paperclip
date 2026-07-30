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

## Hard Rules

> **1. NEVER graphify Paperclip itself.**
> Graphify runs on **project** code only (e.g. UTMS). Paperclip is the infrastructure the agents run
> on, not a project to analyse — and analysing it invites the self-modification that the
> `paperclip-dev` skill forbids. If the target repo is the Paperclip checkout, stop and say so.

> **2. `graphify-out/` lives OUTSIDE the repository and OUTSIDE the project workspace.**
> It is generated output. Never track it, never commit it, never place it inside the project
> directory. Point the output at a location outside the workspace instead.

Why rule 2 is absolute: a single branch once carried **536 committed `graphify-out/` files** around
8 real deliverables, making the branch unreviewable and burying the actual work. Generated graphs
also churn on every run, so committing them produces enormous meaningless diffs and merge conflicts.

If you find `graphify-out/` inside a repo, treat it as cleanup: remove it from tracking, and do not
"refresh and commit" it — that instruction, wherever it appears in older task descriptions, is
superseded by this rule.

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
- The `graphify-out/` directory does not exist and you are not allowed to build it

## Quick Reference

```bash
graphify .                        # build or rebuild the full graph
graphify . --update               # refresh only changed files (fast)
graphify query "what connects X to Y?"
graphify path "ComponentA" "ComponentB"
graphify explain "ClassName"
graphify export callflow-html     # Mermaid architecture page
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
    ↓
[Phase 1] CHECK — does graphify-out/graph.json exist?
    ├── YES → query graph for task context
    └── NO  → build graph first, then query
    ↓
Agent receives task + graph context
    ↓
Agent writes / edits / reviews code
    ↓
[Phase 2] UPDATE — if files were added or significantly changed
    └── run graphify . --update to keep graph current
```

## Phase 1 — Pre-Task Graph Query

Before writing any code, orient yourself using the graph.

### Step 1 — Check graph freshness

```bash
ls graphify-out/graph.json 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

- **Missing** → run `graphify .` to build
- **Exists but stale** (repo changed significantly) → run `graphify . --update`
- **Fresh** → proceed to query

### Step 2 — Choose the right query

| Task type | Query to run |
|-----------|-------------|
| Understand a component | `graphify explain "ComponentName"` |
| Trace a data flow | `graphify query "how does X flow to Y?"` |
| Find dependencies | `graphify query "what depends on X?"` |
| Debug a connection | `graphify path "SourceNode" "TargetNode"` |
| General orientation | Read `graphify-out/GRAPH_REPORT.md` — God Nodes section |

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

## Phase 2 — Post-Task Graph Update

After completing a coding task, update the graph if:
- New files were created
- Existing files had significant structural changes (new classes, functions, imports)
- A module was deleted or renamed

```bash
graphify . --update
```

For minor edits (bug fixes, docstrings, variable renames) — skip the update.

## Query Cheatsheet

```bash
# Understand a specific class or function
graphify explain "AuthMiddleware"

# Find the shortest connection between two things
graphify path "UserService" "DatabasePool"

# Ask natural language questions about architecture
graphify query "what connects the cache layer to the API routes?"
graphify query "which modules import from utils?"
graphify query "where is the rate limiter applied?"

# Deep search with larger budget
graphify query "trace the auth flow from request to token validation" --dfs --budget 2000

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

`graphify-out/` should be committed to git so all agents start with a map:

```bash
# .gitignore additions
echo "graphify-out/manifest.json" >> .gitignore
echo "graphify-out/cost.json" >> .gitignore
```

Auto-rebuild on every commit (AST only, no API cost):
```bash
graphify hook install
```

This also installs a git merge driver for conflict-free `graph.json` union-merging.

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
