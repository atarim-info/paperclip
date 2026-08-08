/**
 * The adapter's own stdout event schema.
 *
 * Freebuff has no headless mode and no machine-readable stdout: its only
 * interface is a full-screen TUI. This adapter drives it through a PTY and
 * reconstructs the transcript from Freebuff's on-disk chat store, then emits
 * *these* events — one JSON object per line — as the run's stdout.
 *
 * Nothing Freebuff prints is ever forwarded. That keeps the UI and CLI parsers
 * reading a schema we own, so Freebuff's TUI can change freely without
 * breaking the run viewer.
 *
 * Shared client/server module: keep it free of `node:` imports and `process`.
 */

export type FreebuffEvent =
  | { t: "status"; ts: string; message: string }
  | { t: "text"; ts: string; text: string; thinking?: boolean }
  | { t: "tool"; ts: string; tool: string }
  | { t: "agent"; ts: string; agent: string; status?: string; text?: string }
  | { t: "ask"; ts: string; text?: string }
  | { t: "mode"; ts: string; mode: string };

export function serializeFreebuffEvent(event: FreebuffEvent): string {
  return `${JSON.stringify(event)}\n`;
}

export function parseFreebuffEvent(line: string): FreebuffEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (typeof record.t !== "string" || typeof record.ts !== "string") return null;
  switch (record.t) {
    case "status":
    case "text":
    case "tool":
    case "agent":
    case "ask":
    case "mode":
      return parsed as FreebuffEvent;
    default:
      return null;
  }
}
