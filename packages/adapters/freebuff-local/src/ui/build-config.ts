import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import { FREEBUFF_DEFAULTS } from "../config.js";

/**
 * Builds the adapterConfig blob from the agent-creation form.
 *
 * Freebuff takes no model flag and no extra CLI args worth surfacing, so the
 * form is deliberately small: where to run, which binary, and the timing knobs
 * that govern PTY prompt injection (documented in ../config.ts).
 */

type FreebuffFormValues = Partial<
  Record<"timeoutSec" | "promptDelayMs" | "promptGraceMs" | "readyTimeoutMs", unknown>
>;

/** Form inputs arrive as strings; keep only finite, non-negative numbers. */
function toNumber(value: unknown): number | null {
  if (typeof value === "string" && !value.trim()) return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function buildFreebuffLocalConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  if (v.cwd) ac.cwd = v.cwd;
  if (v.command) ac.command = v.command;

  const values = v as CreateConfigValues & FreebuffFormValues;

  // timeoutSec accepts 0, which disables the ceiling — so it cannot share the
  // positive-only rule the other three use.
  const timeoutSec = toNumber(values.timeoutSec);
  ac.timeoutSec = timeoutSec ?? FREEBUFF_DEFAULTS.timeoutSec;

  for (const key of ["promptDelayMs", "promptGraceMs", "readyTimeoutMs"] as const) {
    const parsed = toNumber(values[key]);
    if (parsed !== null && parsed > 0) ac[key] = parsed;
  }
  return ac;
}
