import type { FreebuffMessage, FreebuffRunState } from "./chat-store.js";
import { parseLogEntries } from "./chat-store.js";

/**
 * Decides when a Freebuff run is over, and why.
 *
 * Pure: every input is data the watcher has already read, so each row of the
 * table below is unit-testable without launching Freebuff.
 *
 * | signal                                        | outcome          |
 * |-----------------------------------------------|------------------|
 * | "session over" logged before any user message | no_session       |
 * | an ask-user block appears                     | asked_question   |
 * | "session over" logged after work began        | session_expired  |
 * | run-state output.type === "error"             | failed           |
 * | run-state output present, non-error           | completed        |
 * | timeout elapsed                               | timed_out        |
 * | process exited with no terminal signal        | exited_early     |
 */

export type FreebuffOutcome =
  | "completed"
  | "asked_question"
  | "no_session"
  | "session_expired"
  | "failed"
  | "timed_out"
  | "exited_early"
  | "prompt_not_accepted";

export interface TerminalDecision {
  done: boolean;
  outcome: FreebuffOutcome | null;
  reason: string | null;
  /** True for outcomes that are not the adapter's fault and may succeed later. */
  retryable: boolean;
}

const RUNNING: TerminalDecision = { done: false, outcome: null, reason: null, retryable: false };

/** Freebuff logs this the moment it has no usable session, and again on expiry. */
export const SESSION_OVER_MARKER = "Freebuff session over";

export function logHasSessionOver(logText: string): boolean {
  return parseLogEntries(logText).some((entry) => (entry.msg ?? "").includes(SESSION_OVER_MARKER));
}

export interface TerminalInput {
  messages: readonly FreebuffMessage[] | null;
  runState: FreebuffRunState | null;
  logText: string;
  sawAskUser: boolean;
  userMessageCount: number;
  elapsedMs: number;
  timeoutMs: number;
  /**
   * Absolute elapsed-ms deadline (not a duration) by which Freebuff must have
   * recorded a user message. Computed by the caller as
   * `promptSentAt + promptGraceMs`; see ../config.ts for the timeline.
   */
  promptDeadlineMs: number;
  promptSent: boolean;
  processExited: boolean;
}

export function decideTerminal(input: TerminalInput): TerminalDecision {
  const sessionOver = logHasSessionOver(input.logText);

  // No session at all: Freebuff logs "session over" at startup and never opens
  // an input box, so nothing we type can land. Distinguished from mid-run
  // expiry by there being no recorded user message.
  if (sessionOver && input.userMessageCount === 0) {
    return {
      done: true,
      outcome: "no_session",
      reason:
        "Freebuff has no usable session (free-tier quota exhausted); it showed its quota screen instead of a prompt. Check https://freebuff.com/earn or wait for the daily reset.",
      retryable: true,
    };
  }

  if (input.sawAskUser) {
    return {
      done: true,
      outcome: "asked_question",
      reason: "Freebuff asked the user a question; an unattended run cannot answer it.",
      retryable: false,
    };
  }

  if (sessionOver) {
    return {
      done: true,
      outcome: "session_expired",
      reason: "The Freebuff session ended mid-run (free-tier session limit). Partial progress preserved.",
      retryable: true,
    };
  }

  const output = input.runState?.output;
  if (output && typeof output === "object") {
    const type = typeof output.type === "string" ? output.type : "";
    const message = typeof output.message === "string" ? output.message : "";
    if (type === "error") {
      return {
        done: true,
        outcome: "failed",
        reason: message || "Freebuff reported an error.",
        retryable: false,
      };
    }
    if (type) {
      return { done: true, outcome: "completed", reason: null, retryable: false };
    }
  }

  // The prompt was typed but Freebuff never recorded a user message — the TUI
  // was not at an input box (first-run screen, model picker, login).
  if (input.promptSent && input.userMessageCount === 0 && input.elapsedMs > input.promptDeadlineMs) {
    return {
      done: true,
      outcome: "prompt_not_accepted",
      reason: `Freebuff did not record the prompt within ${Math.round(input.promptDeadlineMs / 1000)}s of launch; its UI was probably not at an input box.`,
      retryable: false,
    };
  }

  if (input.processExited) {
    return {
      done: true,
      outcome: "exited_early",
      reason: "The Freebuff process exited before producing a result.",
      retryable: false,
    };
  }

  if (input.elapsedMs >= input.timeoutMs) {
    return {
      done: true,
      outcome: "timed_out",
      reason: `Freebuff did not finish within ${Math.round(input.timeoutMs / 1000)}s.`,
      retryable: false,
    };
  }

  return RUNNING;
}

/** Maps an outcome onto the process-level exit code the server records. */
export function outcomeExitCode(outcome: FreebuffOutcome): number {
  return outcome === "completed" ? 0 : 1;
}
