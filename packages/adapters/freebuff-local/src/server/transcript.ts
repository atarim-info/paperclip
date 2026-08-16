import type { FreebuffBlock, FreebuffMessage } from "./chat-store.js";
import type { FreebuffEvent } from "../events.js";

/**
 * Turns Freebuff's `chat-messages.json` into adapter stdout events.
 *
 * The file is rewritten in full on every flush, so this diffs against a cursor
 * instead of tailing: `TranscriptCursor` records how many blocks of each
 * message have already been emitted, and `diffTranscript` returns only what is
 * new. Pure — no fs, no clock — so it is fully testable against captured
 * fixtures.
 *
 * Block types observed in freebuff 0.0.142:
 *   text | tool | agent | ask-user | mode-divider
 */

export type TranscriptCursor = Record<string, number>;

export interface TranscriptDiff {
  events: FreebuffEvent[];
  cursor: TranscriptCursor;
  /** True once an `ask-user` block has been seen — the run is waiting on a human. */
  sawAskUser: boolean;
  /** Number of user messages recorded; 0 means our prompt never landed. */
  userMessageCount: number;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function blockToEvent(block: FreebuffBlock, ts: string): FreebuffEvent | null {
  switch (block.type) {
    case "text": {
      const text = asString(block.content).trim();
      if (!text) return null;
      // `textType` marks reasoning content; surfaced as thinking in the viewer.
      const thinking = asString(block.textType).toLowerCase().includes("think");
      return thinking ? { t: "text", ts, text, thinking: true } : { t: "text", ts, text };
    }
    case "tool": {
      const tool = asString(block.toolName).trim();
      return tool ? { t: "tool", ts, tool } : null;
    }
    case "agent": {
      const agent = asString(block.agentType).trim() || "agent";
      const status = asString(block.status).trim();
      const text = asString(block.content).trim();
      return {
        t: "agent",
        ts,
        agent,
        ...(status ? { status } : {}),
        ...(text ? { text } : {}),
      };
    }
    case "ask-user": {
      const text = asString(block.content).trim();
      return text ? { t: "ask", ts, text } : { t: "ask", ts };
    }
    case "mode-divider": {
      const mode = asString(block.mode).trim();
      return mode ? { t: "mode", ts, mode } : null;
    }
    default:
      return null;
  }
}

/** Emit whatever is new in `messages` relative to `cursor`. */
export function diffTranscript(
  messages: readonly FreebuffMessage[],
  cursor: TranscriptCursor = {},
  fallbackTs = "",
): TranscriptDiff {
  const events: FreebuffEvent[] = [];
  const next: TranscriptCursor = { ...cursor };
  let sawAskUser = false;
  let userMessageCount = 0;

  for (const message of messages) {
    const ts = asString(message.timestamp) || fallbackTs;
    if (message.variant === "user") {
      userMessageCount += 1;
      // A user message has no blocks; emit its text once, keyed like a block.
      const seen = next[message.id] ?? 0;
      const text = asString(message.content).trim();
      if (seen === 0 && text) {
        events.push({ t: "status", ts, message: `prompt accepted (${text.length} chars)` });
      }
      next[message.id] = 1;
      continue;
    }

    const blocks = Array.isArray(message.blocks) ? message.blocks : [];
    const seen = next[message.id] ?? 0;
    for (let index = seen; index < blocks.length; index += 1) {
      const block = blocks[index]!;
      if (block?.type === "ask-user") sawAskUser = true;
      const event = blockToEvent(block, ts);
      if (event) events.push(event);
    }
    next[message.id] = blocks.length;
    // A cursor rewind means Freebuff rewrote history (e.g. a retry); the
    // recorded count above is authoritative for the next diff either way.
    if (blocks.some((block) => block?.type === "ask-user")) sawAskUser = true;
  }

  return { events, cursor: next, sawAskUser, userMessageCount };
}

/** Best-effort run summary: the last non-empty assistant text block. */
export function summarizeTranscript(messages: readonly FreebuffMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    if (message.variant !== "ai") continue;
    const blocks = Array.isArray(message.blocks) ? message.blocks : [];
    for (let j = blocks.length - 1; j >= 0; j -= 1) {
      const block = blocks[j]!;
      if (block?.type !== "text") continue;
      const text = asString(block.content).trim();
      if (text) return text;
    }
  }
  return null;
}
