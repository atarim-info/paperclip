import type { TranscriptEntry } from "@paperclipai/adapter-utils";

export function parseCrushStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const text = line.trim();
  if (!text) return [];
  return [{ kind: "assistant", ts, text }];
}
