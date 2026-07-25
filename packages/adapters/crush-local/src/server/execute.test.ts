import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runChildProcess, ensureCommandResolvable, resolveCommandForLogs } = vi.hoisted(() => ({
  // Crush `run` emits PLAIN TEXT (not JSONL). The executor captures stdout as the
  // summary and recovers the session id + usage via a SECOND `crush session list
  // --json` spawn. This mock distinguishes the three invocations by their args.
  runChildProcess: vi.fn(async (_runId: string, _command: string, args: string[]) => {
    if (args[0] === "session" && args.includes("list")) {
      return {
        exitCode: 0,
        signal: null,
        timedOut: false,
        stdout: JSON.stringify([{ id: "sess-xyz", usage: { inputTokens: 5, outputTokens: 2 } }]),
        stderr: "",
        pid: 201,
        startedAt: new Date().toISOString(),
      };
    }
    if (args.includes("run")) {
      return {
        exitCode: 0,
        signal: null,
        timedOut: false,
        stdout: "The answer is 42.\n",
        stderr: "",
        pid: 202,
        startedAt: new Date().toISOString(),
      };
    }
    // `crush models` availability probe.
    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: "openai/gpt-4.1\n",
      stderr: "",
      pid: 203,
      startedAt: new Date().toISOString(),
    };
  }),
  ensureCommandResolvable: vi.fn(async () => undefined),
  resolveCommandForLogs: vi.fn(async () => "crush"),
}));

vi.mock("@paperclipai/adapter-utils/server-utils", async () => {
  const actual = await vi.importActual<typeof import("@paperclipai/adapter-utils/server-utils")>(
    "@paperclipai/adapter-utils/server-utils",
  );
  return {
    ...actual,
    ensureCommandResolvable,
    resolveCommandForLogs,
    runChildProcess,
  };
});

import { execute } from "./execute.js";
import { resetCrushModelsCacheForTests } from "./models.js";

describe("crush execute (local)", () => {
  const cleanupDirs: string[] = [];
  let previousHome: string | undefined;

  beforeEach(async () => {
    resetCrushModelsCacheForTests();
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "paperclip-crush-home-"));
    cleanupDirs.push(homeDir);
    previousHome = process.env.HOME;
    process.env.HOME = homeDir;
  });

  afterEach(async () => {
    vi.clearAllMocks();
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    while (cleanupDirs.length > 0) {
      const dir = cleanupDirs.pop();
      if (!dir) continue;
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("returns plain-text stdout as the summary, unknown billing type, and the recovered session id", async () => {
    const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "paperclip-crush-ws-"));
    cleanupDirs.push(workspaceDir);
    const meta: Array<Record<string, unknown>> = [];

    const result = await execute({
      runId: "run-1",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Crush Builder",
        adapterType: "crush_local",
        adapterConfig: {},
      },
      runtime: {
        sessionId: null,
        sessionParams: null,
        sessionDisplayId: null,
        taskKey: null,
      },
      config: {
        command: "crush",
        model: "openai/gpt-4.1",
        promptTemplate: "Do the work.",
      },
      context: {
        paperclipWorkspace: {
          cwd: workspaceDir,
          source: "project_primary",
        },
      },
      onLog: async () => {},
      onMeta: async (entry) => {
        meta.push(entry as unknown as Record<string, unknown>);
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.errorMessage).toBeNull();
    expect(result.summary).toBe("The answer is 42.");
    expect(result.billingType).toBe("unknown");
    expect(result.model).toBe("openai/gpt-4.1");
    expect(result.provider).toBe("openai");
    expect(result.sessionId).toBe("sess-xyz");
    expect(result.sessionDisplayId).toBe("sess-xyz");
    expect(result.usage).toMatchObject({ inputTokens: 5, outputTokens: 2 });
    expect(result.resultJson).toMatchObject({ stdout: "The answer is 42.\n", stderr: "" });
    expect(meta[0]?.adapterType).toBe("crush_local");

    // The second spawn recovers the session via `crush session list --json`.
    const listCall = runChildProcess.mock.calls.find(
      (entry) => Array.isArray(entry[2]) && entry[2][0] === "session" && entry[2].includes("list"),
    );
    expect(listCall).toBeDefined();
    const runCall = runChildProcess.mock.calls.find(
      (entry) => Array.isArray(entry[2]) && entry[2].includes("run"),
    );
    expect(runCall?.[2]).toContain("-m");
    // crushRunModel strips the provider prefix for the `-m` flag (bare name)
    expect(runCall?.[2]).toContain("gpt-4.1");
  });

  it("reports the stderr error message and a non-null exit code on a non-zero run", async () => {
    runChildProcess.mockImplementation(async (_runId: string, _command: string, args: string[]) => {
      if (args[0] === "session" && args.includes("list")) {
        return {
          exitCode: 0,
          signal: null,
          timedOut: false,
          stdout: "[]",
          stderr: "",
          pid: 301,
          startedAt: new Date().toISOString(),
        };
      }
      if (args.includes("run")) {
        return {
          exitCode: 1,
          signal: null,
          timedOut: false,
          stdout: "",
          stderr: "crush: boom\n",
          pid: 302,
          startedAt: new Date().toISOString(),
        };
      }
      return {
        exitCode: 0,
        signal: null,
        timedOut: false,
        stdout: "openai/gpt-4.1\n",
        stderr: "",
        pid: 303,
        startedAt: new Date().toISOString(),
      };
    });

    const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "paperclip-crush-ws-"));
    cleanupDirs.push(workspaceDir);

    const result = await execute({
      runId: "run-2",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Crush Builder",
        adapterType: "crush_local",
        adapterConfig: {},
      },
      runtime: {
        sessionId: null,
        sessionParams: null,
        sessionDisplayId: null,
        taskKey: null,
      },
      config: {
        command: "crush",
        model: "openai/gpt-4.1",
      },
      context: {
        paperclipWorkspace: {
          cwd: workspaceDir,
          source: "project_primary",
        },
      },
      onLog: async () => {},
    });

    expect(result.exitCode).toBe(1);
    expect(result.timedOut).toBe(false);
    expect(result.errorMessage).toBe("crush: boom");
    expect(result.billingType).toBe("unknown");
  });
});
