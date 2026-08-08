/**
 * Shared metadata for the `freebuff_local` adapter.
 *
 * Imported by the UI as well as the server, so it must stay free of `node:`
 * imports and unguarded `process` access.
 */

export const type = "freebuff_local";
export const label = "Freebuff (local)";

export const DEFAULT_FREEBUFF_COMMAND = "freebuff";

/**
 * Freebuff exposes no `--model` flag — the model is chosen in its TUI picker,
 * so this value is descriptive, not prescriptive. It records what Freebuff
 * defaults to (freebuff 0.0.142) for display and reporting only.
 */
export const DEFAULT_FREEBUFF_MODEL = "deepseek-v4-flash-07-31";

/**
 * Models Freebuff offers. Selection is not under the adapter's control; this
 * list exists so the UI can show what a run might use.
 */
export const models: Array<{ id: string; label: string }> = [
  { id: "deepseek-v4-flash-07-31", label: "DeepSeek V4 Flash 07/31 (default)" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro (full mode)" },
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna (full mode)" },
  { id: "minimax-m3", label: "MiniMax M3 (full mode)" },
  { id: "mimo-2.5", label: "MiMo 2.5" },
  { id: "glm-5.2", label: "GLM 5.2 (earned sessions)" },
];

export function isValidFreebuffModelId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export const agentConfigurationDoc = `# freebuff_local agent configuration

Adapter: freebuff_local

Use when:
- You want Paperclip to run Freebuff (CodebuffAI's free coding agent) locally
- The work is exploratory and the free tier's limits are acceptable

Don't use when:
- The work touches sensitive or proprietary code. Freebuff is ad-supported:
  its terms state prompts, messages, code and repository data may be analysed
  to personalise ads, and may be used for AI training. Prefer a BYO-key adapter
  (claude_local, codex_local, crush_local) for anything confidential.
- You need a specific model. Freebuff has no --model flag; the model comes from
  its own picker.
- You need long unattended runs. Outside full-access countries Freebuff runs in
  "limited mode": 6 one-hour sessions per day. A run that outlives its session
  is cut off mid-response.
- You need token or cost accounting. Freebuff reports none.

How it works:
Freebuff has no headless mode, so this adapter runs it inside a pseudo-terminal
(util-linux script(1)) and types the prompt in. The transcript is read from
Freebuff's own chat store under ~/.config/manicode/projects/<workspace>/chats/,
not from the terminal, and re-emitted as structured events.

Core fields:
- command: path to the freebuff binary (default: freebuff)
- cwd: absolute workspace directory (required)
- timeoutSec: hard limit for the whole run (default 1800; 0 disables)
- promptDelayMs: wait after the conversation appears before typing (default 6000)
- promptGraceMs: how long to wait for Freebuff to record the prompt (default 30000)
- readyTimeoutMs: how long to wait for Freebuff to start (default 45000)

Prerequisites:
- \`freebuff login\` must have been run on this host as the Paperclip user;
  the adapter fails fast when ~/.config/manicode/credentials.json is missing.

Failure modes you will see:
- freebuff_no_session: the free-tier quota is exhausted; Freebuff shows its
  quota screen instead of a prompt. Reported as provider_quota.
- freebuff_session_expired: the session ended mid-run. Partial output is kept.
- freebuff_asked_question: Freebuff asked the user something; an unattended run
  cannot answer, so the run fails with the partial transcript.
- freebuff_prompt_not_accepted: Freebuff never recorded the prompt — usually a
  new first-run screen in its UI.
`;
