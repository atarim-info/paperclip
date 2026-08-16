import path from "node:path";
import {
  listChatDirs,
  pickNewChatDir,
  readChatMessages,
  readLogText,
  readRunState,
  type FreebuffMessage,
} from "./chat-store.js";
import { diffTranscript, summarizeTranscript, type TranscriptCursor } from "./transcript.js";
import { decideTerminal, type FreebuffOutcome, type TerminalDecision } from "./terminal.js";
import { serializeFreebuffEvent, type FreebuffEvent } from "../events.js";
import type { FreebuffRunConfig } from "../config.js";

/**
 * The run loop: polls Freebuff's chat store, streams new transcript events, and
 * stops when `decideTerminal` says the run is over.
 *
 * Everything impure is injected (`pty`, `now`, `sleep`, `emit`), so the whole
 * loop can be driven in tests against a fake store and a fake terminal.
 */

export interface FreebuffWatchDeps {
  chatsDir: string;
  prompt: string;
  pty: {
    write(text: string): void;
    submit(): void;
    exited(): boolean;
    bytesPainted(): number;
  };
  emit(chunk: string): Promise<void>;
  now(): number;
  sleep(ms: number): Promise<void>;
  /** Wrap the prompt in bracketed paste before typing it. */
  framePrompt(text: string): string;
  /** Resolved timing knobs; the timeline they describe is in ../config.ts. */
  timing: Pick<
    FreebuffRunConfig,
    "timeoutMs" | "readyTimeoutMs" | "promptDelayMs" | "promptGraceMs" | "pollIntervalMs"
  >;
}

export interface FreebuffWatchResult {
  outcome: FreebuffOutcome;
  reason: string | null;
  retryable: boolean;
  chatDir: string | null;
  summary: string | null;
  messages: FreebuffMessage[] | null;
  eventCount: number;
  bytesPainted: number;
}

export async function watchFreebuffRun(deps: FreebuffWatchDeps): Promise<FreebuffWatchResult> {
  const startedAt = deps.now();
  const before = new Set(listChatDirs(deps.chatsDir));
  const promptFirstLine = deps.prompt.split(/\r?\n/).find((line) => line.trim()) ?? "";

  let chatDir: string | null = null;
  let cursor: TranscriptCursor = {};
  let promptSentAt: number | null = null;
  let eventCount = 0;
  let sawAskUser = false;
  let messages: FreebuffMessage[] | null = null;

  const emitEvents = async (events: FreebuffEvent[]) => {
    for (const event of events) {
      await deps.emit(serializeFreebuffEvent(event));
      eventCount += 1;
    }
  };

  const stamp = () => new Date(deps.now()).toISOString();

  await emitEvents([{ t: "status", ts: stamp(), message: "starting freebuff under a pty" }]);

  for (;;) {
    const elapsed = deps.now() - startedAt;

    if (!chatDir) {
      chatDir = pickNewChatDir(deps.chatsDir, before, promptFirstLine);
      if (chatDir) {
        await emitEvents([
          { t: "status", ts: stamp(), message: `conversation ${path.basename(chatDir)}` },
        ]);
      } else if (elapsed > deps.timing.readyTimeoutMs) {
        return {
          outcome: "exited_early",
          reason: `Freebuff never created a conversation directory under ${deps.chatsDir} within ${Math.round(deps.timing.readyTimeoutMs / 1000)}s.`,
          retryable: false,
          chatDir: null,
          summary: null,
          messages: null,
          eventCount,
          bytesPainted: deps.pty.bytesPainted(),
        };
      }
    }

    if (chatDir) {
      messages = readChatMessages(chatDir) ?? messages;
      if (messages) {
        const diff = diffTranscript(messages, cursor, stamp());
        cursor = diff.cursor;
        sawAskUser = sawAskUser || diff.sawAskUser;
        await emitEvents(diff.events);
      }
    }

    // Type the prompt once the conversation exists and the TUI has settled.
    if (chatDir && promptSentAt === null && elapsed > deps.timing.promptDelayMs) {
      deps.pty.write(deps.framePrompt(deps.prompt));
      deps.pty.submit();
      promptSentAt = deps.now();
      await emitEvents([
        { t: "status", ts: stamp(), message: `prompt typed (${deps.prompt.length} chars)` },
      ]);
    }

    const decision: TerminalDecision = decideTerminal({
      messages,
      runState: chatDir ? readRunState(chatDir) : null,
      logText: chatDir ? readLogText(chatDir) : "",
      sawAskUser,
      userMessageCount: messages ? countUserMessages(messages) : 0,
      elapsedMs: elapsed,
      timeoutMs: deps.timing.timeoutMs,
      promptDeadlineMs:
        (promptSentAt === null ? deps.timing.promptDelayMs : promptSentAt - startedAt) +
        deps.timing.promptGraceMs,
      promptSent: promptSentAt !== null,
      processExited: deps.pty.exited(),
    });

    if (decision.done && decision.outcome) {
      if (decision.reason) {
        await emitEvents([{ t: "status", ts: stamp(), message: decision.reason }]);
      }
      return {
        outcome: decision.outcome,
        reason: decision.reason,
        retryable: decision.retryable,
        chatDir,
        summary: messages ? summarizeTranscript(messages) : null,
        messages,
        eventCount,
        bytesPainted: deps.pty.bytesPainted(),
      };
    }

    await deps.sleep(deps.timing.pollIntervalMs);
  }
}

function countUserMessages(messages: readonly FreebuffMessage[]): number {
  return messages.filter((message) => message.variant === "user").length;
}
