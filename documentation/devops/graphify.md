# Graphify - Paperclip Project Installation

## Status

Installed and configured for the Paperclip project at `/home/vladimir/develop/paperclip`.

## Components Installed

1. **Graphify CLI** (v0.8.44) via `uv tool install graphifyy`
2. **OpenCode integration** via `graphify opencode install`:
   - AGENTS.md section with graphify query-first guidance
   - `.opencode/plugins/graphify.js` tool.execute.before hook
   - `.opencode/opencode.json` plugin registration
3. **Git hooks** via `graphify hook install`:
   - `.git/hooks/post-commit` -- auto-rebuilds graph on commit
   - `.git/hooks/post-checkout` -- auto-rebuilds graph on checkout
   - Git merge driver for graph.json union-merging

## Current Graph

- 25,477 nodes, 53,843 edges, 1,278 communities (code-only AST extraction)
- Output in `graphify-out/`:
  - `graph.json` -- full knowledge graph (27 MB)
  - `GRAPH_REPORT.md` -- human-readable report (274 KB)
  - `manifest.json` -- file manifest

## Usage

```bash
/graphify .

/graphify query "what connects auth to the database?"
/graphify path "ComponentA" "ComponentB"
graphify query "..." --graph graphify-out/graph.json
```

## Next Steps

- Set `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` for full doc/image semantic extraction
- Rebuild: `graphify extract . --backend gemini` (or whichever backend is configured)
