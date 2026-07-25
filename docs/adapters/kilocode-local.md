---
title: Kilo Code (local)
summary: Kilo Code CLI local adapter setup and configuration
---

The `kilocode_local` adapter runs the [Kilo Code](https://kilocode.ai) CLI (`kilo`, npm `@kilocode/cli`) as a local Paperclip agent runtime. Kilo Code is an OpenCode fork, so Paperclip drives it exactly like `opencode_local`: it spawns the local `kilo` binary to run a non-interactive prompt (`kilo run --format json`) inside the agent's workspace and parses the JSON event stream.

"Local" means **local execution**: `kilo` runs on the local machine and uses whatever provider/model routing Kilo is signed in for (`kilo auth`).

## Prerequisites

- Kilo CLI installed (`kilo` on PATH; npm package `@kilocode/cli`)
- Signed in to Kilo (`kilo auth`) with at least one entitled model (verify with `kilo models`)

## Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cwd` | string | No | Default absolute working directory fallback |
| `instructionsFilePath` | string | No | Absolute path to a markdown instructions file prepended to the run prompt |
| `model` | string | Yes | Kilo model id in `kilo/provider/model` form (e.g. `kilo/anthropic/claude-sonnet-4.5`) |
| `variant` | string | No | Provider-specific reasoning variant passed as `--variant` |
| `dangerouslySkipPermissions` | boolean | No | Pass `--dangerously-skip-permissions`; defaults to `true` for unattended runs |
| `command` | string | No | Defaults to `kilo` |
| `extraArgs` | string[] | No | Additional CLI args |
| `env` | object | No | `KEY=VALUE` environment variables |
| `timeoutSec` | number | No | Run timeout in seconds |
| `graceSec` | number | No | SIGTERM grace period in seconds |

## How Runs Are Executed

```sh
kilo run --format json [--session <id>] [--model <kilo/provider/model>] [--variant <v>] ...
```

Session id, token usage, and cost are recovered from the JSON `step_finish`/`error` events (same shape as OpenCode). Sessions resume via `--session` when the stored session cwd matches the current cwd.

## Model Discovery

Run `kilo models` to list available options; ids are `kilo/provider/model` (alias providers appear as `kilo/~provider/model`). The adapter surfaces models dynamically with a static fallback list.

- Default model: `kilo/anthropic/claude-sonnet-4.5`
- Cheap lane (`modelProfiles.cheap`): `kilo/anthropic/claude-haiku-4.5` (override via `PAPERCLIP_KILO_CHEAP_MODEL` / `PAPERCLIP_KILO_SMALL_MODEL`)

## Billing

Passthrough/BYO: `billingType: "passthrough"`, provider = the model's provider segment. Bring your own Kilo sign-in.
