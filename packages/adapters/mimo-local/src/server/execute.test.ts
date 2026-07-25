import { afterEach, describe, expect, it } from "vitest";

import { ensureRemoteMimoModelConfiguredAndAvailable } from "./execute.js";

describe("ensureRemoteMimoModelConfiguredAndAvailable", () => {
  afterEach(() => {
    delete process.env.MIMO_ALLOW_ALL_MODELS;
  });

  // The remote/sandbox execution path must honour MIMO_ALLOW_ALL_MODELS just
  // like the local path: gateway-routed models (e.g. anthropic/<gateway>/<model>
  // via Bifrost) never appear in `mimo models`, so the availability probe
  // must be skipped. The early return happens before the executionTarget is ever
  // touched, so a bogus target proves the probe was not run.
  const bogusTarget = {} as never;

  it("skips the remote availability probe when MIMO_ALLOW_ALL_MODELS is set in the run env", async () => {
    await expect(
      ensureRemoteMimoModelConfiguredAndAvailable({
        runId: "run-1",
        executionTarget: bogusTarget,
        command: "mimo",
        model: "anthropic/tensorix/deepseek/deepseek-chat-v3.1",
        cwd: "/tmp",
        env: { MIMO_ALLOW_ALL_MODELS: "true" },
        timeoutSec: 30,
        graceSec: 5,
      }),
    ).resolves.toBeUndefined();
  });

  it("honours MIMO_ALLOW_ALL_MODELS from the process env", async () => {
    process.env.MIMO_ALLOW_ALL_MODELS = "1";
    await expect(
      ensureRemoteMimoModelConfiguredAndAvailable({
        runId: "run-2",
        executionTarget: bogusTarget,
        command: "mimo",
        model: "anthropic/tensorix/deepseek/deepseek-chat-v3.1",
        cwd: "/tmp",
        env: {},
        timeoutSec: 30,
        graceSec: 5,
      }),
    ).resolves.toBeUndefined();
  });

  it("still enforces provider/model format even when the bypass flag is set", async () => {
    await expect(
      ensureRemoteMimoModelConfiguredAndAvailable({
        runId: "run-3",
        executionTarget: bogusTarget,
        command: "mimo",
        model: "",
        cwd: "/tmp",
        env: { MIMO_ALLOW_ALL_MODELS: "true" },
        timeoutSec: 30,
        graceSec: 5,
      }),
    ).rejects.toThrow();
  });
});
