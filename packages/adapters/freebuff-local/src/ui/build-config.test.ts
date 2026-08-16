import { describe, expect, it } from "vitest";
import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import { buildFreebuffLocalConfig } from "./build-config.js";
import { FREEBUFF_DEFAULTS } from "../config.js";

function values(extra: Record<string, unknown> = {}): CreateConfigValues {
  return { cwd: "/srv/work", ...extra } as CreateConfigValues;
}

describe("buildFreebuffLocalConfig", () => {
  // Regression: the form wrote values.timeoutSec but the builder hard-coded
  // 1800, so a user-specified ceiling was silently discarded at create time.
  it("honours the timeout the user typed on the create form", () => {
    expect(buildFreebuffLocalConfig(values({ timeoutSec: "600" })).timeoutSec).toBe(600);
    expect(buildFreebuffLocalConfig(values({ timeoutSec: 600 })).timeoutSec).toBe(600);
  });

  it("keeps 0 as an explicit 'no ceiling' rather than replacing it", () => {
    expect(buildFreebuffLocalConfig(values({ timeoutSec: 0 })).timeoutSec).toBe(0);
  });

  it("falls back to the default when the field is blank or nonsense", () => {
    for (const raw of ["", "   ", undefined, "abc", -1]) {
      expect(buildFreebuffLocalConfig(values({ timeoutSec: raw })).timeoutSec).toBe(
        FREEBUFF_DEFAULTS.timeoutSec,
      );
    }
  });

  it("passes through the PTY timing knobs when set", () => {
    const ac = buildFreebuffLocalConfig(
      values({ promptDelayMs: "9000", promptGraceMs: 45_000, readyTimeoutMs: "60000" }),
    );
    expect(ac).toMatchObject({ promptDelayMs: 9000, promptGraceMs: 45_000, readyTimeoutMs: 60_000 });
  });

  it("omits timing knobs that are blank or non-positive", () => {
    const ac = buildFreebuffLocalConfig(values({ promptDelayMs: "", promptGraceMs: 0, readyTimeoutMs: -5 }));
    expect(ac).not.toHaveProperty("promptDelayMs");
    expect(ac).not.toHaveProperty("promptGraceMs");
    expect(ac).not.toHaveProperty("readyTimeoutMs");
  });

  it("carries cwd and command through", () => {
    const ac = buildFreebuffLocalConfig(values({ command: "/opt/freebuff" }));
    expect(ac).toMatchObject({ cwd: "/srv/work", command: "/opt/freebuff" });
  });
});
