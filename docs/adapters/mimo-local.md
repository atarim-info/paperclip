---
title: MiMo (local)
summary: MiMoCode CLI local adapter setup and configuration
---

The `mimo_local` adapter runs the [MiMoCode](https://mimocode.ai) CLI (`mimo`) as a local Paperclip agent runtime. MiMoCode is an OpenCode fork, so Paperclip drives it exactly like `opencode_local`: it spawns the local `mimo` binary to run a non-interactive prompt (`mimo run --format json`) inside the agent's workspace and parses the JSON event stream.

"Local" means **local execution**: `mimo` runs on the local machine and uses whatever provider/model routing MiMo is signed in for (`mimo providers`).

## Prerequisites

- MiMoCode CLI installed (`mimo` on PATH; self-contained binary under `~/.mimocode/bin`)
- Signed in to at least one provider (`mimo providers`; verify with `mimo models`)

## Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cwd` | string | No | Default absolute working directory fallback |
| `instructionsFilePath` | string | No | Absolute path to a markdown instructions file prepended to the run prompt |
| `model` | string | Yes | MiMo model id in `provider/model` form (e.g. `xiaomi/mimo-v2.5-pro`) |
| `variant` | string | No | Provider-specific reasoning variant passed as `--variant` |
| `dangerouslySkipPermissions` | boolean | No | Pass `--dangerously-skip-permissions`; defaults to `true` for unattended runs |
| `command` | string | No | Defaults to `mimo` |
| `extraArgs` | string[] | No | Additional CLI args |
| `env` | object | No | `KEY=VALUE` environment variables |
| `timeoutSec` | number | No | Run timeout in seconds |
| `graceSec` | number | No | SIGTERM grace period in seconds |

## How Runs Are Executed

```sh
mimo run --format json [--session <id>] [--model <provider/model>] [--variant <v>] ...
```

Session id, token usage, and cost are recovered from the JSON `step_finish`/`error` events (same shape as OpenCode). Sessions resume via `--session` when the stored session cwd matches the current cwd.

## Model Discovery

Run `mimo models` to list available options in `provider/model` format (e.g. `xiaomi/mimo-v2.5-pro`, plus the virtual `mimo/mimo-auto` router). The adapter surfaces models dynamically with a static fallback list.

- Default model: `xiaomi/mimo-v2.5-pro`
- Cheap lane (`modelProfiles.cheap`): `xiaomi/mimo-v2.5` (override via `PAPERCLIP_MIMO_CHEAP_MODEL` / `PAPERCLIP_MIMO_SMALL_MODEL`)

## Billing

Passthrough/BYO: `billingType: "passthrough"`, provider = the model's provider segment. Bring your own MiMo sign-in.
