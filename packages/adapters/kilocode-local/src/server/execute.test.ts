import { afterEach, describe, expect, it } from "vitest";

import { ensureRemoteKiloModelConfiguredAndAvailable } from "./execute.js";

describe("ensureRemoteKiloModelConfiguredAndAvailable", () => {
  afterEach(() => {
    delete process.env.KILO_ALLOW_ALL_MODELS;
  });

  // The remote/sandbox execution path must honour KILO_ALLOW_ALL_MODELS just
  // like the local path: gateway-routed models (e.g. anthropic/<gateway>/<model>
  // via Bifrost) never appear in `kilo models`, so the availability probe
  // must be skipped. The early return happens before the executionTarget is ever
  // touched, so a bogus target proves the probe was not run.
  const bogusTarget = {} as never;

  it("skips the remote availability probe when KILO_ALLOW_ALL_MODELS is set in the run env", async () => {
    await expect(
      ensureRemoteKiloModelConfiguredAndAvailable({
        runId: "run-1",
        executionTarget: bogusTarget,
        command: "kilo",
        model: "kilo/anthropic/tensorix/deepseek/deepseek-chat-v3.1",
        cwd: "/tmp",
        env: { KILO_ALLOW_ALL_MODELS: "true" },
        timeoutSec: 30,
        graceSec: 5,
      }),
    ).resolves.toBeUndefined();
  });

  it("honours KILO_ALLOW_ALL_MODELS from the process env", async () => {
    process.env.KILO_ALLOW_ALL_MODELS = "1";
    await expect(
      ensureRemoteKiloModelConfiguredAndAvailable({
        runId: "run-2",
        executionTarget: bogusTarget,
        command: "kilo",
        model: "kilo/anthropic/tensorix/deepseek/deepseek-chat-v3.1",
        cwd: "/tmp",
        env: {},
        timeoutSec: 30,
        graceSec: 5,
      }),
    ).resolves.toBeUndefined();
  });

  it("still enforces provider/model format even when the bypass flag is set", async () => {
    await expect(
      ensureRemoteKiloModelConfiguredAndAvailable({
        runId: "run-3",
        executionTarget: bogusTarget,
        command: "kilo",
        model: "",
        cwd: "/tmp",
        env: { KILO_ALLOW_ALL_MODELS: "true" },
        timeoutSec: 30,
        graceSec: 5,
      }),
    ).rejects.toThrow();
  });
});
