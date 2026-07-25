import { describe, expect, it } from "vitest";
import { buildCrushRunArgs, buildCrushSessionListArgs } from "./crush-args.js";

describe("buildCrushRunArgs", () => {
  it("starts with the run subcommand and sets cwd + data dir", () => {
    const args = buildCrushRunArgs({ cwd: "/w", dataDir: "/d" });
    expect(args).toEqual(["run", "--quiet", "-c", "/w", "-D", "/d"]);
  });

  it("adds session, model, small-model and extra args in order", () => {
    const args = buildCrushRunArgs({
      cwd: "/w",
      dataDir: "/d",
      sessionId: "sess-1",
      model: "anthropic/claude-sonnet-4-5-20250929",
      smallModel: "anthropic/claude-haiku-4-5-20251001",
      extraArgs: ["--debug"],
    });
    expect(args).toEqual([
      "run", "--quiet", "-c", "/w", "-D", "/d",
      "-s", "sess-1",
      // `-m` uses the bare model name (provider prefix stripped by crushRunModel)
      "-m", "claude-sonnet-4-5-20250929",
      "--small-model", "anthropic/claude-haiku-4-5-20251001",
      "--debug",
    ]);
  });

  it("omits model flags when not provided", () => {
    const args = buildCrushRunArgs({ cwd: "/w", dataDir: "/d", model: null });
    expect(args).not.toContain("-m");
    expect(args).not.toContain("--small-model");
  });
});

describe("buildCrushSessionListArgs", () => {
  it("requests machine-readable session output for the run's cwd + data dir", () => {
    expect(buildCrushSessionListArgs({ cwd: "/w", dataDir: "/d" })).toEqual([
      "session", "list", "--json", "-c", "/w", "-D", "/d",
    ]);
  });
});
