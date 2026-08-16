import type { AdapterSessionCodec } from "@paperclipai/adapter-utils";

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * TRACEABILITY ONLY — this is not a resume handle.
 *
 * Freebuff's unit of continuity is a conversation directory under its chat
 * store, and `--continue <conversation-id>` could resume one. Paperclip-level
 * resume is deliberately NOT implemented: `execute` never passes `--continue`,
 * and `ADAPTER_SESSION_MANAGEMENT.freebuff_local` declares
 * `supportsSessionResume: false`.
 *
 * The id is persisted purely so a run can be traced back to the conversation
 * it produced on disk. Treating a persisted id as proof of continuity would be
 * wrong: a run may end at any point (`ask-user`, session expiry) with its
 * conversation half-finished, and the next run starts a fresh one.
 *
 * If resume is implemented later, flip `supportsSessionResume` in
 * packages/adapter-utils/src/session-compaction.ts in the same change --
 * `assertFreebuffSessionIsTraceabilityOnly` guards that the two stay in step.
 */
export const sessionCodec: AdapterSessionCodec = {
  deserialize(raw: unknown) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    const conversationId =
      readNonEmptyString(record.conversationId) ??
      readNonEmptyString(record.sessionId) ??
      readNonEmptyString(record.conversation_id);
    if (!conversationId) return null;
    const cwd = readNonEmptyString(record.cwd) ?? readNonEmptyString(record.workdir);
    return { conversationId, sessionId: conversationId, ...(cwd ? { cwd } : {}) };
  },
  serialize(params: Record<string, unknown> | null) {
    if (!params) return null;
    const conversationId =
      readNonEmptyString(params.conversationId) ??
      readNonEmptyString(params.sessionId) ??
      readNonEmptyString(params.conversation_id);
    if (!conversationId) return null;
    const cwd = readNonEmptyString(params.cwd) ?? readNonEmptyString(params.workdir);
    return { conversationId, sessionId: conversationId, ...(cwd ? { cwd } : {}) };
  },
  getDisplayId(params: Record<string, unknown> | null) {
    if (!params) return null;
    return readNonEmptyString(params.conversationId) ?? readNonEmptyString(params.sessionId);
  },
};

/**
 * Fails loudly if someone marks freebuff_local as resumable without also
 * teaching `execute` to pass `--continue`. Called from the package's tests.
 */
export function assertFreebuffSessionIsTraceabilityOnly(
  sessionManagement: { supportsSessionResume?: boolean } | null | undefined,
): void {
  if (sessionManagement?.supportsSessionResume) {
    throw new Error(
      "freebuff_local declares supportsSessionResume: true, but execute() never passes --continue. " +
        "Implement resume in execute() before flipping this flag, or Paperclip will assume a " +
        "continuity that does not exist.",
    );
  }
}

export { execute } from "./execute.js";
export { testEnvironment } from "./test.js";
export { watchFreebuffRun } from "./watch.js";
export { decideTerminal, outcomeExitCode, logHasSessionOver } from "./terminal.js";
export { diffTranscript, summarizeTranscript } from "./transcript.js";
export {
  freebuffProjectChatsDir,
  freebuffConfigDir,
  hasFreebuffCredentials,
  listChatDirs,
  pickNewChatDir,
  readChatMessages,
  readChatMeta,
  readRunState,
  readLogText,
  parseLogEntries,
} from "./chat-store.js";
export { spawnFreebuffPty, bracketPaste, buildPtyArgv } from "./pty.js";
