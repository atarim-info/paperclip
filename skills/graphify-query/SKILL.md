---
name: graphify-query
description: >
  Query the codebase knowledge graph to understand architecture, trace call flows,
  find dependencies, and navigate code structure without re-reading files.
  READ ONLY — does not modify or rebuild the graph.
---

# Graphify Query

Query the existing code graph to understand code structure, trace flows, and find connections. This skill is READ ONLY — it never builds or updates the graph.

## Hard Rules

> **1. NEVER graphify Paperclip itself.**
> Graphify runs on **project** code only (e.g. UTMS, backoffice, infrastructure). Paperclip is the infrastructure the agents run on, not a project to analyse. If the target repo is the Paperclip checkout, stop and say so.

> **2. `graphify-out/` lives at the shared projects root only.**
> Single `graphify-out/` at `/home/vladimir/projects/Projects/paperclip-projects/graphify-out/`.
> Never create, modify, or commit `graphify-out/` files. This skill is READ ONLY.

## When to use

- Exploring an unfamiliar repo — understand the architecture before making changes
- Tracing a call flow or data flow across modules
- Finding what connects two components or what depends on something
- Debugging a cross-module issue
- Onboarding to a new project
- Before writing, refactoring, or reviewing code
- When a task mentions "graph the code", "map the project", "what depends on X", "where is Y called", or "understand the codebase"

## When NOT to use

- Simple single-file edits where no cross-module context is needed
- The task is about building or updating the graph (use `graphify-update` instead)
- The user explicitly says not to use it
- The `graphify-out/` directory does not exist (use `graphify-update` to build it first)

## Quick Reference

```bash
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

## Pre-Task Graph Query

Before writing any code, orient yourself using the graph.

### Step 1 — Check graph freshness

The graph lives at the shared projects root:
```bash
ls /home/vladimir/projects/Projects/paperclip-projects/graphify-out/graph.json 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

- **Missing** — run `graphify-update` to build, then return here
- **Exists but stale** (repo changed significantly) — run `graphify-update` to refresh, then return here
- **Fresh** — proceed to query

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

## Reading the Graph Report

`graphify-out/GRAPH_REPORT.md` always contains:

- **God Nodes** — highest-connectivity concepts. Any non-trivial task likely touches these.
- **Surprising connections** — links across modules that are not obvious from file structure.
- **The "why"** — inline `# NOTE:`, `# WHY:`, `# HACK:` comments extracted as graph nodes.
- **Suggested questions** — 4–5 questions the graph can answer that grep cannot.
- **Confidence tags** — `EXTRACTED` (found in code) vs `INFERRED` (model-guessed) vs `AMBIGUOUS`.

Always check confidence tags before acting on a relationship — `AMBIGUOUS` links need manual verification before assuming they are real.

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
| Graph does not exist | Run `graphify-update` to build it first |
| Graph too large for browser | Use `--no-viz` and query via CLI or MCP server |

## Hard Rules

1. **Never skip Phase 1** for tasks touching more than one module. The graph reveals connections invisible from file structure alone.
2. **God Nodes are your anchor.** If a task touches a God Node, assume wide blast radius and query for all dependents.
3. **This skill is READ ONLY.** Never run `graphify .` or `graphify . --update` — use `graphify-update` for that.
