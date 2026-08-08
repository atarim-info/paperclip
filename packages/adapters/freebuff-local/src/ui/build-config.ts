import type { CreateConfigValues } from "@paperclipai/adapter-utils";

/**
 * Builds the adapterConfig blob from the agent-creation form.
 *
 * Freebuff takes no model flag and no extra CLI args worth surfacing, so the
 * form is deliberately small: where to run, which binary, and the timing knobs
 * that govern PTY prompt injection.
 */
export function buildFreebuffLocalConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  if (v.cwd) ac.cwd = v.cwd;
  if (v.command) ac.command = v.command;
  ac.timeoutSec = 1800;

  const extras = v as Partial<Record<"promptDelayMs" | "promptGraceMs" | "readyTimeoutMs", unknown>>;
  for (const key of ["promptDelayMs", "promptGraceMs", "readyTimeoutMs"] as const) {
    const raw = extras[key];
    const value = typeof raw === "string" ? Number(raw) : raw;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) ac[key] = value;
  }
  return ac;
}
