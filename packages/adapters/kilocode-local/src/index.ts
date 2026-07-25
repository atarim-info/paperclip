import type { AdapterModelProfileDefinition } from "@paperclipai/adapter-utils";

export const type = "kilocode_local";
export const label = "Kilo Code (local)";

// Kilo ships as a normal npm global (the `@kilocode/cli` package exposes the
// `kilo` binary), so a plain `npm install -g` is enough -- no curl|bash
// installer like OpenCode. This install command is used as the sandbox/remote
// fallback when `kilo` is not already resolvable on PATH.
export const SANDBOX_INSTALL_COMMAND = "npm install -g @kilocode/cli";

export const DEFAULT_KILO_LOCAL_MODEL = "kilo/anthropic/claude-sonnet-4.5";

// Kilo namespaces every model under `kilo/<provider>/<model>` (the provider
// segment may carry a `~` alias prefix, e.g. `kilo/~openai/gpt-latest`). The
// virtual `kilo-auto/*` router ids are not valid for `--model`, so we require
// the `kilo/` prefix and at least a provider + model segment after it.
export function isValidKiloModelId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith("kilo/")) return false;
  const rest = trimmed.slice("kilo/".length).replace(/^~/, "");
  const slash = rest.indexOf("/");
  return slash > 0 && slash !== rest.length - 1;
}

export const models: Array<{ id: string; label: string }> = [
  { id: DEFAULT_KILO_LOCAL_MODEL, label: DEFAULT_KILO_LOCAL_MODEL },
  { id: "kilo/anthropic/claude-opus-4.5", label: "kilo/anthropic/claude-opus-4.5" },
  { id: "kilo/anthropic/claude-haiku-4.5", label: "kilo/anthropic/claude-haiku-4.5" },
  { id: "kilo/~openai/gpt-latest", label: "kilo/~openai/gpt-latest" },
  { id: "kilo/~google/gemini-flash-latest", label: "kilo/~google/gemini-flash-latest" },
];

export const DEFAULT_KILO_CHEAP_MODEL = "kilo/anthropic/claude-haiku-4.5";

// The "cheap" budget profile (used for recovery retries and other low-cost
// lanes). Defaults to Kilo's Haiku model, overridable via
// PAPERCLIP_KILO_CHEAP_MODEL (falling back to PAPERCLIP_KILO_SMALL_MODEL) so a
// gateway-routed deployment can repoint the budget lane at a served model.
//
// This module is shared client/server code (the UI imports it for
// DEFAULT_KILO_LOCAL_MODEL etc.), so it must not touch the global `process`
// unguarded: in the browser a bare `process.env` throws at module load. Guard
// with `typeof process` and fall back to an empty env.
export function buildKiloModelProfiles(
  env: NodeJS.ProcessEnv = typeof process === "undefined" ? {} : process.env,
): AdapterModelProfileDefinition[] {
  const override = (env.PAPERCLIP_KILO_CHEAP_MODEL ?? env.PAPERCLIP_KILO_SMALL_MODEL)?.trim();
  return [
    {
      key: "cheap",
      label: "Cheap",
      description: "Budget lane model for recovery retries and other low-cost tasks.",
      adapterConfig: { model: override || DEFAULT_KILO_CHEAP_MODEL },
      source: "adapter_default",
    },
  ];
}

export const modelProfiles: AdapterModelProfileDefinition[] = buildKiloModelProfiles();

export const agentConfigurationDoc = `# kilocode_local agent configuration

Adapter: kilocode_local

Use when:
- You want Paperclip to run the Kilo Code CLI locally as the agent runtime
- You want provider/model routing in Kilo format (kilo/provider/model)
- You want Kilo session resume across heartbeats via --session

Don't use when:
- You need webhook-style external invocation (use openclaw_gateway or http)
- You only need one-shot shell commands (use process)
- The Kilo CLI (@kilocode/cli) is not installed on the machine

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to the run prompt
- model (string, required): Kilo model id in kilo/provider/model format (for example kilo/anthropic/claude-sonnet-4.5)
- variant (string, optional): provider-specific reasoning/profile variant passed as --variant (for example minimal|low|medium|high|xhigh|max)
- dangerouslySkipPermissions (boolean, optional): pass --dangerously-skip-permissions so headless runs do not stall on approval prompts; defaults to true for unattended Paperclip runs
- promptTemplate (string, optional): run prompt template
- command (string, optional): defaults to "kilo"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Kilo supports multiple providers and models. Use \`kilo models\` to list available options; ids are in kilo/provider/model format.
- Paperclip requires an explicit \`model\` value for \`kilocode_local\` agents.
- Runs are executed with: kilo run --format json ...
- Sessions are resumed with --session when stored session cwd matches current cwd.
`;
