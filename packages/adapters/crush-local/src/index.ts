import type { AdapterModelProfileDefinition } from "@paperclipai/adapter-utils";

export const type = "crush_local";
export const label = "Crush (local)";

// Crush accepts either a bare model name or a `provider/model` string
// (`crush run -m ...`), so any non-empty string is a valid model id.
export function isValidCrushModelId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Static fallback list surfaced in the UI when live `crush models` discovery
// is unavailable. Discovery (server/models.ts) is authoritative. Ids verified
// against `crush models` (Crush v0.84.1, Catwalk provider registry).
export const models: Array<{ id: string; label: string }> = [
  { id: "anthropic/claude-sonnet-4-5-20250929", label: "anthropic/claude-sonnet-4-5" },
  { id: "anthropic/claude-opus-4-8", label: "anthropic/claude-opus-4-8" },
  { id: "anthropic/claude-haiku-4-5-20251001", label: "anthropic/claude-haiku-4-5" },
  { id: "openai/gpt-5.2-codex", label: "openai/gpt-5.2-codex" },
  { id: "openai/gpt-5.4", label: "openai/gpt-5.4" },
];

export const DEFAULT_CRUSH_CHEAP_MODEL = "anthropic/claude-haiku-4-5-20251001";

// Shared client/server module: must not touch `process` unguarded (the UI
// imports it, and a bare `process.env` throws in the browser at module load).
export function buildCrushModelProfiles(
  env: NodeJS.ProcessEnv = typeof process === "undefined" ? {} : process.env,
): AdapterModelProfileDefinition[] {
  const override = env.PAPERCLIP_CRUSH_CHEAP_MODEL?.trim();
  return [
    {
      key: "cheap",
      label: "Cheap",
      description: "Budget lane model for recovery retries and other low-cost tasks.",
      adapterConfig: { model: override || DEFAULT_CRUSH_CHEAP_MODEL },
      source: "adapter_default",
    },
  ];
}

export const modelProfiles: AdapterModelProfileDefinition[] = buildCrushModelProfiles();

export const agentConfigurationDoc = `# crush_local agent configuration

Adapter: crush_local

Use when:
- You want Paperclip to run Charm's Crush CLI locally as the agent runtime
- Crush is already configured with a provider (your API keys or a local
  OpenAI-compatible endpoint) — this adapter runs Crush as a local process and
  does not configure the model provider for you
- You want Crush session resume across heartbeats via --session

Don't use when:
- You need webhook-style external invocation (use openclaw_gateway or http)
- You only need one-shot shell commands (use process)
- The Crush CLI is not installed on the machine

Core fields:
- cwd (string, optional): default absolute working directory fallback
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to the run prompt
- model (string, optional): Crush model id, either 'model' or 'provider/model'. When omitted, Crush uses its own configured default model.
- smallModel (string, optional): Crush small/auxiliary model, passed as --small-model
- promptTemplate (string, optional): run prompt template
- command (string, optional): defaults to "crush"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Crush supports multiple providers. Run \\\`crush models\\\` to list available options in provider/model format.
- Runs are executed with: crush run --quiet -c <cwd> -D <dataDir> [-m <model>] ...
- \\\`crush run\\\` is non-interactive and proceeds headlessly without any permission
  prompts or flags (\\\`--yolo\\\` is TUI-only and is rejected by \\\`run\\\`).
- The prompt is delivered on stdin.
- Sessions are resumed with --session when the stored session cwd matches.
- Because \\\`crush run\\\` emits plain text, the session id and token usage are
  recovered after the run via \\\`crush session list --json\\\` (usage is best-effort).
`;
