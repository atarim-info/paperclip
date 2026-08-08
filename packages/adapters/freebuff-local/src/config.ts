/**
 * One place for everything tunable about a Freebuff run.
 *
 * The timing knobs govern a single timeline, and reading them in isolation
 * makes that hard to see, so it is spelled out here once:
 *
 * ```
 * t=0            spawn `freebuff` under the PTY
 *   |
 *   |<-- readyTimeoutMs ------>|   a chat directory must appear by here,
 *   |                              or the run fails `exited_early`
 *   |
 *   |<-- promptDelayMs -->|        settle time; the prompt is typed at this
 *   |                              point (only once the chat dir exists)
 *                         |
 *                         |<-- promptGraceMs -->|
 *                                               Freebuff must have recorded a
 *                                               user message by here, or the
 *                                               run fails `prompt_not_accepted`
 *   |<----------------- timeoutSec ---------------------->| hard ceiling
 * ```
 *
 * `pollIntervalMs` is how often the chat store is re-read; it bounds how
 * promptly all of the above are noticed.
 *
 * Resolution order for every value is **adapterConfig > environment >
 * default**, so a non-standard install can be fixed machine-wide with an env
 * var without editing every agent.
 *
 * Shared client/server module: no `node:` imports, no unguarded `process`.
 */

export const DEFAULT_FREEBUFF_COMMAND = "freebuff";

/**
 * util-linux `script(1)`, used to allocate the PTY. Overridable because the
 * binary is not always on PATH under that name (busybox, some WSL images,
 * Windows toolchains) — see `resolveFreebuffRunConfig`.
 */
export const DEFAULT_PTY_LAUNCHER = "script";

export const FREEBUFF_DEFAULTS = {
  timeoutSec: 1800,
  readyTimeoutMs: 45_000,
  promptDelayMs: 6_000,
  promptGraceMs: 30_000,
  pollIntervalMs: 500,
} as const;

/** Environment overrides, applied when adapterConfig leaves a value unset. */
export const FREEBUFF_ENV_VARS = {
  command: "PAPERCLIP_FREEBUFF_COMMAND",
  ptyLauncher: "PAPERCLIP_FREEBUFF_PTY_LAUNCHER",
  timeoutSec: "PAPERCLIP_FREEBUFF_TIMEOUT_SEC",
  readyTimeoutMs: "PAPERCLIP_FREEBUFF_READY_TIMEOUT_MS",
  promptDelayMs: "PAPERCLIP_FREEBUFF_PROMPT_DELAY_MS",
  promptGraceMs: "PAPERCLIP_FREEBUFF_PROMPT_GRACE_MS",
  pollIntervalMs: "PAPERCLIP_FREEBUFF_POLL_INTERVAL_MS",
} as const;

export interface FreebuffRunConfig {
  command: string;
  ptyLauncher: string;
  /** Hard ceiling in ms. `Number.POSITIVE_INFINITY` when timeoutSec <= 0. */
  timeoutMs: number;
  readyTimeoutMs: number;
  promptDelayMs: number;
  promptGraceMs: number;
  pollIntervalMs: number;
}

type EnvLike = Record<string, string | undefined>;

function pickString(
  configValue: unknown,
  env: EnvLike,
  envVar: string,
  fallback: string,
): string {
  if (typeof configValue === "string" && configValue.trim()) return configValue.trim();
  const fromEnv = env[envVar];
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  return fallback;
}

/**
 * Positive finite numbers only. A zero or negative duration would collapse the
 * timeline above (typing before the TUI exists, or failing instantly), so such
 * values fall through to the next source rather than being honoured.
 */
function pickPositiveNumber(
  configValue: unknown,
  env: EnvLike,
  envVar: string,
  fallback: number,
): number {
  const fromConfig = toPositiveNumber(configValue);
  if (fromConfig !== null) return fromConfig;
  const fromEnv = toPositiveNumber(env[envVar]);
  if (fromEnv !== null) return fromEnv;
  return fallback;
}

function toPositiveNumber(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * `timeoutSec` is the one value where 0 is meaningful: it disables the ceiling.
 * Negative values are treated as "disabled" too rather than firing instantly.
 */
export function resolveTimeoutMs(configValue: unknown, env: EnvLike = {}): number {
  const raw =
    typeof configValue === "number" || typeof configValue === "string"
      ? Number(configValue)
      : Number(env[FREEBUFF_ENV_VARS.timeoutSec] ?? Number.NaN);
  const seconds = Number.isFinite(raw) ? raw : FREEBUFF_DEFAULTS.timeoutSec;
  return seconds > 0 ? seconds * 1000 : Number.POSITIVE_INFINITY;
}

export function resolveFreebuffRunConfig(
  adapterConfig: Record<string, unknown> = {},
  env: EnvLike = {},
): FreebuffRunConfig {
  return {
    command: pickString(adapterConfig.command, env, FREEBUFF_ENV_VARS.command, DEFAULT_FREEBUFF_COMMAND),
    ptyLauncher: pickString(
      adapterConfig.ptyLauncher,
      env,
      FREEBUFF_ENV_VARS.ptyLauncher,
      DEFAULT_PTY_LAUNCHER,
    ),
    timeoutMs: resolveTimeoutMs(adapterConfig.timeoutSec, env),
    readyTimeoutMs: pickPositiveNumber(
      adapterConfig.readyTimeoutMs,
      env,
      FREEBUFF_ENV_VARS.readyTimeoutMs,
      FREEBUFF_DEFAULTS.readyTimeoutMs,
    ),
    promptDelayMs: pickPositiveNumber(
      adapterConfig.promptDelayMs,
      env,
      FREEBUFF_ENV_VARS.promptDelayMs,
      FREEBUFF_DEFAULTS.promptDelayMs,
    ),
    promptGraceMs: pickPositiveNumber(
      adapterConfig.promptGraceMs,
      env,
      FREEBUFF_ENV_VARS.promptGraceMs,
      FREEBUFF_DEFAULTS.promptGraceMs,
    ),
    pollIntervalMs: pickPositiveNumber(
      adapterConfig.pollIntervalMs,
      env,
      FREEBUFF_ENV_VARS.pollIntervalMs,
      FREEBUFF_DEFAULTS.pollIntervalMs,
    ),
  };
}
