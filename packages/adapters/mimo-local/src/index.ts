import type { AdapterModelProfileDefinition } from "@paperclipai/adapter-utils";

export const type = "mimo_local";
export const label = "MiMo (local)";

// MiMoCode ships as a self-contained binary (installed under ~/.mimocode/bin
// via the official installer). This install command is used as the
// sandbox/remote fallback when `mimo` is not already resolvable on PATH; it
// mirrors OpenCode's curl-installer pattern and symlinks the binary onto a
// directory that non-login `sh -c` probe shells have on PATH.
export const SANDBOX_INSTALL_COMMAND =
  "curl -fsSL https://mimocode.ai/install | bash && " +
  'if [ -x "$HOME/.mimocode/bin/mimo" ]; then ' +
  'if [ "$(id -u)" -eq 0 ]; then ' +
  'ln -sf "$HOME/.mimocode/bin/mimo" /usr/local/bin/mimo; ' +
  'elif command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then ' +
  'sudo ln -sf "$HOME/.mimocode/bin/mimo" /usr/local/bin/mimo; ' +
  "else " +
  'mkdir -p "$HOME/.local/bin" && ln -sf "$HOME/.mimocode/bin/mimo" "$HOME/.local/bin/mimo"; ' +
  "fi; " +
  "fi";

export const DEFAULT_MIMO_LOCAL_MODEL = "xiaomi/mimo-v2.5-pro";

// MiMo (an OpenCode fork) uses plain `provider/model` ids (e.g.
// `xiaomi/mimo-v2.5-pro`), plus the virtual auto-router `mimo/mimo-auto`. Any
// id with a non-terminal `/` separator is accepted; `mimo models` lists the
// concrete options.
export function isValidMimoModelId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  const slashIndex = trimmed.indexOf("/");
  return Boolean(trimmed) && slashIndex > 0 && slashIndex !== trimmed.length - 1;
}

export const models: Array<{ id: string; label: string }> = [
  { id: DEFAULT_MIMO_LOCAL_MODEL, label: DEFAULT_MIMO_LOCAL_MODEL },
  { id: "xiaomi/mimo-v2.5", label: "xiaomi/mimo-v2.5" },
  { id: "xiaomi/mimo-v2.5-pro-ultraspeed", label: "xiaomi/mimo-v2.5-pro-ultraspeed" },
  { id: "mimo/mimo-auto", label: "mimo/mimo-auto" },
];

export const DEFAULT_MIMO_CHEAP_MODEL = "xiaomi/mimo-v2.5";

// The "cheap" budget profile (used for recovery retries and other low-cost
// lanes). Defaults to the base MiMo model, overridable via
// PAPERCLIP_MIMO_CHEAP_MODEL (falling back to PAPERCLIP_MIMO_SMALL_MODEL) so a
// gateway-routed deployment can repoint the budget lane at a served model.
//
// This module is shared client/server code (the UI imports it for
// DEFAULT_MIMO_LOCAL_MODEL etc.), so it must not touch the global `process`
// unguarded: in the browser a bare `process.env` throws at module load. Guard
// with `typeof process` and fall back to an empty env.
export function buildMimoModelProfiles(
  env: NodeJS.ProcessEnv = typeof process === "undefined" ? {} : process.env,
): AdapterModelProfileDefinition[] {
  const override = (env.PAPERCLIP_MIMO_CHEAP_MODEL ?? env.PAPERCLIP_MIMO_SMALL_MODEL)?.trim();
  return [
    {
      key: "cheap",
      label: "Cheap",
      description: "Budget lane model for recovery retries and other low-cost tasks.",
      adapterConfig: { model: override || DEFAULT_MIMO_CHEAP_MODEL },
      source: "adapter_default",
    },
  ];
}

export const modelProfiles: AdapterModelProfileDefinition[] = buildMimoModelProfiles();

export const agentConfigurationDoc = `# mimo_local agent configuration

Adapter: mimo_local

Use when:
- You want Paperclip to run the MiMoCode CLI locally as the agent runtime
- You want provider/model routing in MiMo format (provider/model)
- You want MiMo session resume across heartbeats via --session

Don't use when:
- You need webhook-style external invocation (use openclaw_gateway or http)
- You only need one-shot shell commands (use process)
- The MiMoCode CLI (mimo) is not installed on the machine

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to the run prompt
- model (string, required): MiMo model id in provider/model format (for example xiaomi/mimo-v2.5-pro)
- variant (string, optional): provider-specific reasoning/profile variant passed as --variant (for example minimal|low|medium|high|xhigh|max)
- dangerouslySkipPermissions (boolean, optional): pass --dangerously-skip-permissions so headless runs do not stall on approval prompts; defaults to true for unattended Paperclip runs
- promptTemplate (string, optional): run prompt template
- command (string, optional): defaults to "mimo"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- MiMo supports multiple providers and models. Use \`mimo models\` to list available options in provider/model format.
- Paperclip requires an explicit \`model\` value for \`mimo_local\` agents.
- Runs are executed with: mimo run --format json ...
- Sessions are resumed with --session when stored session cwd matches current cwd.
`;
