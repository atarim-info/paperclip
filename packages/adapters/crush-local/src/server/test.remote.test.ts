import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdapterExecutionTarget } from "@paperclipai/adapter-utils/execution-target";

const {
  ensureAdapterExecutionTargetDirectory,
  ensureAdapterExecutionTargetCommandResolvable,
  runAdapterExecutionTargetProcess,
  describeAdapterExecutionTarget,
  resolveAdapterExecutionTargetCwd,
} = vi.hoisted(() => {
  return {
    ensureAdapterExecutionTargetDirectory: vi.fn(async () => {}),
    ensureAdapterExecutionTargetCommandResolvable: vi.fn(async () => {}),
    runAdapterExecutionTargetProcess: vi.fn(async () => ({
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: "ok",
      stderr: "",
      pid: 123,
      startedAt: new Date().toISOString(),
    })),
    describeAdapterExecutionTarget: vi.fn(() => "QA Cloudflare"),
    resolveAdapterExecutionTargetCwd: vi.fn((target, configuredCwd, fallbackCwd) => {
      if (typeof configuredCwd === "string" && configuredCwd.trim().length > 0) return configuredCwd;
      if (target && typeof target === "object" && "remoteCwd" in target && typeof target.remoteCwd === "string") {
        return target.remoteCwd;
      }
      return fallbackCwd;
    }),
  };
});

vi.mock("@paperclipai/adapter-utils/execution-target", async () => {
  const actual = await vi.importActual<typeof import("@paperclipai/adapter-utils/execution-target")>(
    "@paperclipai/adapter-utils/execution-target",
  );
  return {
    ...actual,
    ensureAdapterExecutionTargetDirectory,
    ensureAdapterExecutionTargetCommandResolvable,
    runAdapterExecutionTargetProcess,
    describeAdapterExecutionTarget,
    resolveAdapterExecutionTargetCwd,
  };
});

import { testEnvironment } from "./test.js";

describe("crush remote environment diagnostics", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("runs the ok probe inside a remote execution target and passes", async () => {
    const remoteTarget: AdapterExecutionTarget = {
      kind: "remote",
      transport: "sandbox",
      providerKey: "cloudflare",
      remoteCwd: "/remote/workspace",
      runner: {
        execute: async () => ({
          exitCode: 0,
          signal: null,
          timedOut: false,
          stdout: "",
          stderr: "",
          pid: null,
          startedAt: new Date().toISOString(),
        }),
      },
    };

    const result = await testEnvironment({
      companyId: "company-1",
      adapterType: "crush_local",
      config: {
        command: "crush",
        model: "anthropic/claude-sonnet-4-5-20250929",
      },
      executionTarget: remoteTarget,
      environmentName: "QA Cloudflare",
    });

    expect(result.status).toBe("pass");
    expect(result.checks.map((check) => check.code)).toEqual(
      expect.arrayContaining(["crush_command_resolvable", "crush_probe_passed"]),
    );

    const probeCall = runAdapterExecutionTargetProcess.mock.calls[0] as unknown as
      | [string, AdapterExecutionTarget, string, string[], { cwd: string; stdin: string }]
      | undefined;
    expect(probeCall?.[1]).toBe(remoteTarget);
    expect(probeCall?.[2]).toBe("crush");
    expect(probeCall?.[3]).toEqual([
      "run",
      "--quiet",
      "-c",
      "/remote/workspace",
      "-D",
      "/remote/workspace/.crush",
      "-m",
      "claude-sonnet-4-5-20250929",
    ]);
    expect(probeCall?.[4].cwd).toBe("/remote/workspace");
    expect(probeCall?.[4].stdin).toBe("reply with the single word: ok");
  });

  it("classifies a provider-auth failure as warn, not fail", async () => {
    runAdapterExecutionTargetProcess.mockResolvedValueOnce({
      exitCode: 1,
      signal: null,
      timedOut: false,
      stdout: "",
      stderr: "Error: no providers configured. Run `crush auth login` to configure a provider.",
      pid: 123,
      startedAt: new Date().toISOString(),
    });

    const remoteTarget: AdapterExecutionTarget = {
      kind: "remote",
      transport: "sandbox",
      providerKey: "cloudflare",
      remoteCwd: "/remote/workspace",
      runner: {
        execute: async () => ({
          exitCode: 0,
          signal: null,
          timedOut: false,
          stdout: "",
          stderr: "",
          pid: null,
          startedAt: new Date().toISOString(),
        }),
      },
    };

    const result = await testEnvironment({
      companyId: "company-1",
      adapterType: "crush_local",
      config: {
        command: "crush",
        model: "anthropic/claude-sonnet-4-5-20250929",
      },
      executionTarget: remoteTarget,
      environmentName: "QA Cloudflare",
    });

    expect(result.status).toBe("warn");
    const authCheck = result.checks.find((check) => check.code === "crush_probe_auth_required");
    expect(authCheck).toBeTruthy();
    expect(authCheck?.level).toBe("warn");
    expect(authCheck?.hint).toMatch(/crush login/i);
    expect(result.checks.some((check) => check.level === "error")).toBe(false);
  });

  it("treats an absent model as a pass with an informational check", async () => {
    const result = await testEnvironment({
      companyId: "company-1",
      adapterType: "crush_local",
      config: {
        command: "crush",
        cwd: "/local/workspace",
      },
    });

    expect(result.status).toBe("pass");
    const modelCheck = result.checks.find((check) => check.code === "crush_model_not_configured");
    expect(modelCheck).toBeTruthy();
    expect(modelCheck?.level).toBe("info");
    expect(modelCheck?.message).toBe("No model configured; Crush will use its own default.");

    const probeCall = runAdapterExecutionTargetProcess.mock.calls[0] as unknown as
      | [string, unknown, string, string[], { stdin: string }]
      | undefined;
    // No `-m` flag when no model is configured.
    expect(probeCall?.[3]).toEqual([
      "run",
      "--quiet",
      "-c",
      "/local/workspace",
      "-D",
      "/local/workspace/.crush",
    ]);
  });
});
