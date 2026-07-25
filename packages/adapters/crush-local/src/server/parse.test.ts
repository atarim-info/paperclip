import { describe, expect, it } from "vitest";
import { parseCrushRunSummary, parseCrushSessionList, isCrushUnknownSessionError } from "./parse.js";

describe("parseCrushRunSummary", () => {
  it("returns the trimmed plain-text response", () => {
    expect(parseCrushRunSummary("\n  Hello world  \n")).toBe("Hello world");
  });
});

describe("parseCrushSessionList", () => {
  it("returns nulls/zeros for empty or non-JSON output", () => {
    expect(parseCrushSessionList("[]")).toEqual({
      sessionId: null,
      usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
      costUsd: 0,
    });
    const styledError = parseCrushSessionList("  ERROR  \n  No sessions found.  ");
    expect(styledError.sessionId).toBeNull();
  });

  it("picks the newest session by updated timestamp and reads usage", () => {
    const json = JSON.stringify([
      { id: "old", updatedAt: "2026-07-10T00:00:00Z" },
      {
        id: "new",
        updatedAt: "2026-07-12T00:00:00Z",
        usage: { inputTokens: 100, outputTokens: 40, cacheReadTokens: 10 },
        cost: 0.0123,
      },
    ]);
    const parsed = parseCrushSessionList(json);
    expect(parsed.sessionId).toBe("new");
    expect(parsed.usage).toEqual({ inputTokens: 100, outputTokens: 40, cachedInputTokens: 10 });
    expect(parsed.costUsd).toBeCloseTo(0.0123);
  });

  it("falls back to array order when timestamps are absent", () => {
    const json = JSON.stringify([{ sessionId: "a" }, { sessionId: "b" }]);
    expect(parseCrushSessionList(json).sessionId).toBe("b");
  });
});

describe("isCrushUnknownSessionError", () => {
  it("detects missing-session errors", () => {
    expect(isCrushUnknownSessionError("", "session not found")).toBe(true);
    expect(isCrushUnknownSessionError("No sessions found.", "")).toBe(true);
    expect(isCrushUnknownSessionError("ok", "")).toBe(false);
  });
});
