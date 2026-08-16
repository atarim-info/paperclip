import { describe, expect, it } from "vitest";
import { decideTerminal, logHasSessionOver, outcomeExitCode, type TerminalInput } from "./terminal.js";

// Real lines captured from a freebuff 0.0.142 log.jsonl.
const SESSION_OVER_LINE = JSON.stringify({
  level: "INFO",
  timestamp: "2026-08-07T22:12:31.564Z",
  msg: "[chat-runtime] Freebuff session over; holding queued messages until rejoin",
});
const RECONNECT_LINE = JSON.stringify({
  level: "INFO",
  timestamp: "2026-08-07T22:12:36.326Z",
  msg: "Reconnection detected, firing onReconnect callback",
  data: { isInitialConnection: true },
});

function input(overrides: Partial<TerminalInput> = {}): TerminalInput {
  return {
    messages: [],
    runState: null,
    logText: RECONNECT_LINE,
    sawAskUser: false,
    userMessageCount: 1,
    elapsedMs: 1_000,
    timeoutMs: 600_000,
    promptDeadlineMs: 30_000,
    promptSent: true,
    processExited: false,
    ...overrides,
  };
}

describe("logHasSessionOver", () => {
  it("detects the marker and tolerates a torn tail line", () => {
    expect(logHasSessionOver(`${SESSION_OVER_LINE}\n{"level":"INFO","ms`)).toBe(true);
  });

  it("is false for an ordinary log", () => {
    expect(logHasSessionOver(RECONNECT_LINE)).toBe(false);
  });
});

describe("decideTerminal", () => {
  it("keeps running while nothing terminal has happened", () => {
    expect(decideTerminal(input()).done).toBe(false);
  });

  it("reports no_session when the quota screen appears before any message", () => {
    const decision = decideTerminal(input({ logText: SESSION_OVER_LINE, userMessageCount: 0 }));
    expect(decision.outcome).toBe("no_session");
    expect(decision.retryable).toBe(true);
    expect(decision.reason).toMatch(/quota/i);
  });

  it("reports session_expired when the session ends after work began", () => {
    const decision = decideTerminal(input({ logText: SESSION_OVER_LINE, userMessageCount: 1 }));
    expect(decision.outcome).toBe("session_expired");
    expect(decision.retryable).toBe(true);
  });

  it("fails on ask-user rather than stalling", () => {
    const decision = decideTerminal(input({ sawAskUser: true }));
    expect(decision.outcome).toBe("asked_question");
    expect(decision.retryable).toBe(false);
  });

  it("treats an error output as a failure, quoting Freebuff's message", () => {
    const decision = decideTerminal(
      input({
        runState: {
          output: {
            type: "error",
            message: "The session ended before this response completed. Partial progress has been preserved.",
          },
        },
      }),
    );
    expect(decision.outcome).toBe("failed");
    expect(decision.reason).toContain("Partial progress");
  });

  it("completes on a non-error output", () => {
    const decision = decideTerminal(input({ runState: { output: { type: "success", message: "done" } } }));
    expect(decision).toMatchObject({ done: true, outcome: "completed", reason: null });
  });

  it("gives up when the prompt was typed but never recorded", () => {
    const decision = decideTerminal(input({ userMessageCount: 0, elapsedMs: 40_000 }));
    expect(decision.outcome).toBe("prompt_not_accepted");
  });

  it("does not cry prompt_not_accepted before the grace period", () => {
    expect(decideTerminal(input({ userMessageCount: 0, elapsedMs: 5_000 })).done).toBe(false);
  });

  it("reports an early exit and a timeout", () => {
    expect(decideTerminal(input({ processExited: true })).outcome).toBe("exited_early");
    expect(decideTerminal(input({ elapsedMs: 600_000 })).outcome).toBe("timed_out");
  });

  it("prioritises the quota screen over a bare process exit", () => {
    const decision = decideTerminal(
      input({ logText: SESSION_OVER_LINE, userMessageCount: 0, processExited: true }),
    );
    expect(decision.outcome).toBe("no_session");
  });
});

describe("outcomeExitCode", () => {
  it("is zero only for a completed run", () => {
    expect(outcomeExitCode("completed")).toBe(0);
    expect(outcomeExitCode("no_session")).toBe(1);
    expect(outcomeExitCode("asked_question")).toBe(1);
  });
});
