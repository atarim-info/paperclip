# `freebuff_local` adapter

Runs [Freebuff](https://freebuff.com) — CodebuffAI's free, ad-supported coding
agent — as a local Paperclip agent runtime.

## How it differs from every other adapter

Freebuff has **no headless mode**. Its entire CLI is:

```
freebuff [login] [--continue [conversation-id]] [--cwd <directory>] [-v] [-h]
```

There is no `--print`, no `--json`, no positional prompt; piping a prompt into
it opens its full-screen TUI anyway. So instead of spawning a headless
subcommand and parsing stdout, this adapter:

1. Runs Freebuff inside a pseudo-terminal allocated with util-linux
   `script(1)` — no `node-pty`, no native module.
2. Types the prompt into the TUI (bracketed paste), and
3. Reconstructs the transcript from Freebuff's **on-disk chat store**, never
   from the screen:

```
~/.config/manicode/projects/<basename(cwd)>/chats/<ISO-8601>/
  chat-meta.json      {messageCount, firstPrompt, ...}
  chat-messages.json  [{id, variant, content, blocks, timestamp}]
  run-state.json      {sessionState, traceSessionId, output}
  log.jsonl           lifecycle events
```

Those blocks (`text`, `tool`, `agent`, `ask-user`, `mode-divider`) are re-emitted
as the adapter's own NDJSON events, which the UI and CLI parsers consume. Nothing
Freebuff prints is forwarded, so its TUI can change without breaking the run
viewer.

## Prerequisites

- `npm install -g freebuff`
- `freebuff login` — run interactively on the host, as the Paperclip user. The
  adapter fails fast when `~/.config/manicode/credentials.json` is missing,
  because a run cannot complete an interactive login.
- `script(1)` (util-linux), for the PTY.

## Config fields

| Field | Default | Purpose |
|---|---|---|
| `cwd` | — | Absolute workspace directory (required) |
| `command` | `freebuff` | Path to the binary |
| `timeoutSec` | `1800` | Hard ceiling for the run; `0` disables |
| `promptDelayMs` | `6000` | Settle time before typing the prompt |
| `promptGraceMs` | `30000` | How long to wait for Freebuff to record the prompt |
| `readyTimeoutMs` | `45000` | How long to wait for Freebuff to start |
| `ptyLauncher` | `script` | PTY allocator, for hosts where `script(1)` is elsewhere |
| `homeDir` | `os.homedir()` | Where to look for the chat store and credentials |

Every value resolves **adapterConfig > environment > default**, so a
non-standard install can be fixed machine-wide without editing each agent:

| Env var | Overrides |
|---|---|
| `PAPERCLIP_FREEBUFF_COMMAND` | `command` |
| `PAPERCLIP_FREEBUFF_PTY_LAUNCHER` | `ptyLauncher` |
| `PAPERCLIP_FREEBUFF_TIMEOUT_SEC` | `timeoutSec` |
| `PAPERCLIP_FREEBUFF_READY_TIMEOUT_MS` | `readyTimeoutMs` |
| `PAPERCLIP_FREEBUFF_PROMPT_DELAY_MS` | `promptDelayMs` |
| `PAPERCLIP_FREEBUFF_PROMPT_GRACE_MS` | `promptGraceMs` |
| `PAPERCLIP_FREEBUFF_POLL_INTERVAL_MS` | `pollIntervalMs` |

The timing knobs describe one timeline, drawn in full in
`packages/adapters/freebuff-local/src/config.ts`:

```
t=0            spawn freebuff under the PTY
  |<-- readyTimeoutMs ------>|   chat dir must appear, else exited_early
  |<-- promptDelayMs -->|        prompt typed here
                        |<-- promptGraceMs -->|
                                              a user message must be recorded,
                                              else prompt_not_accepted
  |<----------------- timeoutSec ------------------>| hard ceiling
```

There is no model field: Freebuff has no `--model` flag, so the model comes from
its own picker. The `models` list in the adapter is descriptive only.

## Outcomes

| `errorCode` | Meaning |
|---|---|
| *(none, exit 0)* | Freebuff wrote a non-error `run-state.json.output` |
| `freebuff_no_session` | Free-tier quota exhausted — Freebuff showed its quota screen instead of a prompt. Reported as `provider_quota`. |
| `freebuff_session_expired` | The session ended mid-run. Partial transcript preserved. Reported as `provider_quota`. |
| `freebuff_asked_question` | Freebuff emitted `ask-user`; an unattended run cannot answer, so the run fails with what it has. |
| `freebuff_prompt_not_accepted` | The prompt was typed but never recorded — usually a new first-run screen. Try raising `promptDelayMs`. |
| `freebuff_timed_out` / `freebuff_exited_early` | As named. |

No usage or cost is reported: Freebuff exposes no token accounting.

## Limits and data handling

Freebuff is free because it is ad-supported. Its terms state that prompts,
messages, code and repository data may be analysed — including pasted content —
to personalise ads, and may be used for AI training where a model or feature
says so. **Prefer a BYO-key adapter (`claude_local`, `codex_local`,
`crush_local`) for anything confidential.**

Outside full-access countries (or on a VPN) Freebuff runs in "limited mode": 6
one-hour sessions per day. A run that outlives its session is cut off
mid-response and reported as `freebuff_session_expired`.

## Known limitations

- **Local execution only.** Driving a TUI over a remote transport is out of
  scope, so there is no remote/sandbox branch.
- **No session resume.** `--continue <conversation-id>` exists and the
  conversation id is persisted, but that id is **traceability only** — it
  records which on-disk conversation a run produced, and is not a resume
  handle. `execute` never passes `--continue`, and `supportsSessionResume` is
  `false`. A run can end at any point (`ask-user`, session expiry) with its
  conversation half-finished, so a persisted id is no proof of continuity.
  `assertFreebuffSessionIsTraceabilityOnly` fails the test suite if the flag is
  flipped without implementing resume.
- **Prompt injection is screen-driven.** We never read the screen, but we do
  type into it, so a change to Freebuff's startup flow can break prompt
  delivery. That surfaces as `freebuff_prompt_not_accepted` rather than a hang.
- **Project directories collide on basename** — Freebuff keys them on
  `basename(cwd)`, so two checkouts named the same share one directory. The
  adapter disambiguates concurrent runs by matching `chat-meta.json.firstPrompt`.

Design notes and the full CLI investigation live in the Documentation vault:
`paperclip/adapters/2026-08-07-freebuff-local-adapter-design.md`.
