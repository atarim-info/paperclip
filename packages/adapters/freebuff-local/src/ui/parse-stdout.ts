import type { TranscriptEntry } from "@paperclipai/adapter-utils";
import { parseFreebuffEvent } from "../events.js";

/**
 * Maps the adapter's own NDJSON events onto run-viewer transcript entries.
 *
 * The events are produced by this adapter (see ../events.ts), never by
 * Freebuff, so this parser reads a schema we control.
 */
export function parseFreebuffStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const event = parseFreebuffEvent(line);
  if (!event) {
    const text = line.trim();
    return text ? [{ kind: "stdout", ts, text }] : [];
  }
  const at = event.ts || ts;
  switch (event.t) {
    case "status":
      return [{ kind: "system", ts: at, text: event.message }];
    case "text":
      return [{ kind: event.thinking ? "thinking" : "assistant", ts: at, text: event.text }];
    case "tool":
      return [{ kind: "tool_call", ts: at, name: event.tool, input: null }];
    case "agent": {
      const suffix = event.status ? ` (${event.status})` : "";
      const detail = event.text ? `: ${event.text}` : "";
      return [{ kind: "system", ts: at, text: `subagent ${event.agent}${suffix}${detail}` }];
    }
    case "ask":
      return [
        {
          kind: "system",
          ts: at,
          text: event.text
            ? `Freebuff asked the user: ${event.text}`
            : "Freebuff asked the user a question.",
        },
      ];
    case "mode":
      return [{ kind: "system", ts: at, text: `mode: ${event.mode}` }];
    default:
      return [];
  }
}
