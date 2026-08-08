import { describe, expect, it } from "vitest";
import {
  DEFAULT_FREEBUFF_COMMAND,
  DEFAULT_PTY_LAUNCHER,
  FREEBUFF_DEFAULTS,
  FREEBUFF_ENV_VARS,
  resolveFreebuffRunConfig,
  resolveTimeoutMs,
} from "./config.js";

describe("resolveFreebuffRunConfig", () => {
  it("falls back to defaults when nothing is configured", () => {
    const resolved = resolveFreebuffRunConfig();
    expect(resolved.command).toBe(DEFAULT_FREEBUFF_COMMAND);
    expect(resolved.ptyLauncher).toBe(DEFAULT_PTY_LAUNCHER);
    expect(resolved.timeoutMs).toBe(FREEBUFF_DEFAULTS.timeoutSec * 1000);
    expect(resolved.promptDelayMs).toBe(FREEBUFF_DEFAULTS.promptDelayMs);
  });

  it("lets the environment override defaults for non-standard installs", () => {
    const resolved = resolveFreebuffRunConfig(
      {},
      {
        [FREEBUFF_ENV_VARS.command]: "/opt/freebuff/bin/freebuff",
        [FREEBUFF_ENV_VARS.ptyLauncher]: "/usr/bin/util-linux-script",
        [FREEBUFF_ENV_VARS.promptDelayMs]: "9000",
      },
    );
    expect(resolved.command).toBe("/opt/freebuff/bin/freebuff");
    expect(resolved.ptyLauncher).toBe("/usr/bin/util-linux-script");
    expect(resolved.promptDelayMs).toBe(9000);
  });

  it("lets adapterConfig win over the environment", () => {
    const resolved = resolveFreebuffRunConfig(
      { command: "from-config", promptDelayMs: 1234 },
      { [FREEBUFF_ENV_VARS.command]: "from-env", [FREEBUFF_ENV_VARS.promptDelayMs]: "9000" },
    );
    expect(resolved.command).toBe("from-config");
    expect(resolved.promptDelayMs).toBe(1234);
  });

  it("ignores blank and non-positive durations rather than collapsing the timeline", () => {
    const resolved = resolveFreebuffRunConfig(
      { command: "   ", promptDelayMs: 0, readyTimeoutMs: -5, pollIntervalMs: Number.NaN },
      {},
    );
    expect(resolved.command).toBe(DEFAULT_FREEBUFF_COMMAND);
    expect(resolved.promptDelayMs).toBe(FREEBUFF_DEFAULTS.promptDelayMs);
    expect(resolved.readyTimeoutMs).toBe(FREEBUFF_DEFAULTS.readyTimeoutMs);
    expect(resolved.pollIntervalMs).toBe(FREEBUFF_DEFAULTS.pollIntervalMs);
  });

  it("accepts numeric strings, as env vars and form fields deliver them", () => {
    expect(resolveFreebuffRunConfig({ promptGraceMs: "2500" }).promptGraceMs).toBe(2500);
  });
});

describe("resolveTimeoutMs", () => {
  it("converts seconds to milliseconds", () => {
    expect(resolveTimeoutMs(90)).toBe(90_000);
    expect(resolveTimeoutMs("90")).toBe(90_000);
  });

  it("treats zero and negative as no ceiling, not as instant expiry", () => {
    expect(resolveTimeoutMs(0)).toBe(Number.POSITIVE_INFINITY);
    expect(resolveTimeoutMs(-1)).toBe(Number.POSITIVE_INFINITY);
  });

  it("reads the env var only when no config value is present", () => {
    expect(resolveTimeoutMs(undefined, { [FREEBUFF_ENV_VARS.timeoutSec]: "60" })).toBe(60_000);
    expect(resolveTimeoutMs(30, { [FREEBUFF_ENV_VARS.timeoutSec]: "60" })).toBe(30_000);
  });

  it("falls back to the default when both are absent or unparseable", () => {
    expect(resolveTimeoutMs(undefined)).toBe(FREEBUFF_DEFAULTS.timeoutSec * 1000);
    expect(resolveTimeoutMs("not-a-number")).toBe(FREEBUFF_DEFAULTS.timeoutSec * 1000);
  });
});
