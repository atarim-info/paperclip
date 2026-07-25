---
title: Crush Local
summary: Charm Crush CLI local adapter setup and configuration
---

The `crush_local` adapter runs Charm's [Crush](https://github.com/charmbracelet/crush) CLI as a local Paperclip agent runtime. Paperclip spawns the local `crush` binary to run a non-interactive prompt inside the agent's workspace, mirroring the existing `opencode_local` / `codex_local` adapters.

"Local" here means **local execution**: Crush runs on the local machine and uses whatever model provider Crush is already configured with (your own API keys or a local OpenAI-compatible endpoint). This adapter does **not** auto-configure a model provider — it simply selects the model string and lets Crush's own config decide the backend.

## Prerequisites

- Crush CLI installed (`crush` command available; npm package `@charmland/crush`)
- Crush configured with at least one provider (run `crush models` to verify)

## Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cwd` | string | No | Default absolute working directory fallback |
| `instructionsFilePath` | string | No | Absolute path to a markdown instructions file prepended to the run prompt |
| `model` | string | No | Crush model id, either `model` or `provider/model`. When omitted, Crush uses its own configured default |
| `smallModel` | string | No | Auxiliary model passed as `--small-model` |
| `dangerouslySkipPermissions` | boolean | No | Pass Crush's global `--yolo` flag to auto-accept permissions; defaults to `true` for unattended runs |
| `promptTemplate` | string | No | Run prompt template |
| `command` | string | No | Defaults to `crush` |
| `extraArgs` | string[] | No | Additional CLI args |
| `env` | object | No | `KEY=VALUE` environment variables |
| `timeoutSec` | number | No | Run timeout in seconds |
| `graceSec` | number | No | SIGTERM grace period in seconds |

## How Runs Are Executed

Runs are executed with:

```sh
crush --yolo run --quiet -c <cwd> -D <dataDir> [-m <model>] [--small-model <model>] [-s <sessionId>] ...
```

The prompt is delivered on stdin. Because `crush run` emits plain text, the session id and token usage are recovered after the run via `crush session list --json` (best-effort; usage is populated when the session JSON carries it, `null`/zero otherwise).

## Session Resume

Crush supports `--session <id>` for session resume. The adapter round-trips `{ sessionId, cwd, workspace identity }` across heartbeats and resumes the stored session when its cwd matches.

## Model Discovery

Crush supports multiple providers. Run `crush models` to list available options in `provider/model` format. The adapter surfaces models dynamically from `crush models` with a static fallback list used when live discovery is unavailable. The model picker offers a refresh action that re-runs discovery, and the model field is optional — when blank, Crush uses its own configured default model.

## Environment Test

The adapter test probe (`POST /api/companies/:companyId/adapters/crush_local/test-environment`) checks: the workspace cwd exists, the `crush` command is resolvable, at least one model is available via `crush models`, and a lightweight "reply with a single word" probe run succeeds. Returns `status: pass|warn|fail` with per-check detail.

## Billing

Billing is passthrough/BYO: `billingType: "passthrough"`, `provider` = the model's provider segment. Bring your own provider credentials in Crush's own config.
