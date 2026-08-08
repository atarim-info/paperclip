import type { AdapterSessionCodec } from "@paperclipai/adapter-utils";

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Freebuff's unit of continuity is a conversation directory under its chat
 * store; `--continue <conversation-id>` can resume one. Paperclip-level resume
 * is not wired up yet (see the adapter's design doc), but the id is persisted
 * so a run can be traced back to its conversation on disk.
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
