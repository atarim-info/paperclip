import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Reader for Freebuff's on-disk chat store.
 *
 * Freebuff persists every conversation under a per-project directory keyed on
 * the *basename* of the working directory (verified against freebuff 0.0.142):
 *
 *   ~/.config/manicode/projects/<basename(cwd)>/chats/<ISO-8601>/
 *     chat-meta.json      {messageCount, firstPrompt, messagesSize, messagesMtimeMs}
 *     chat-messages.json  [{id, variant, content, blocks, timestamp}]
 *     run-state.json      {sessionState, traceSessionId, output}
 *     log.jsonl           pino-style lifecycle log
 *
 * Every read here is tolerant: the files are written by another process while
 * we watch them, so a partially flushed JSON read is expected and must never
 * throw — callers get `null` and retry on the next poll.
 */

export interface FreebuffBlock {
  type: string;
  content?: unknown;
  textType?: unknown;
  toolName?: unknown;
  agentType?: unknown;
  status?: unknown;
  mode?: unknown;
}

export interface FreebuffMessage {
  id: string;
  variant: string;
  content?: unknown;
  blocks?: FreebuffBlock[];
  timestamp?: unknown;
}

export interface FreebuffRunState {
  traceSessionId?: unknown;
  output?: { type?: unknown; message?: unknown } | null;
}

export interface FreebuffChatMeta {
  messageCount?: unknown;
  firstPrompt?: unknown;
}

export const FREEBUFF_STORE_DIRNAME = "manicode";

/** Root of Freebuff's config/state directory. */
export function freebuffConfigDir(homeDir: string = os.homedir()): string {
  return path.join(homeDir, ".config", FREEBUFF_STORE_DIRNAME);
}

/**
 * Project directory for a workspace.
 *
 * NOTE: Freebuff keys this on `basename(cwd)` only, so two different checkouts
 * with the same directory name share one project directory. `pickNewChatDir`
 * compensates by matching on the prompt we sent.
 */
export function freebuffProjectChatsDir(cwd: string, homeDir: string = os.homedir()): string {
  return path.join(freebuffConfigDir(homeDir), "projects", path.basename(path.resolve(cwd)), "chats");
}

export function credentialsPath(homeDir: string = os.homedir()): string {
  return path.join(freebuffConfigDir(homeDir), "credentials.json");
}

export function hasFreebuffCredentials(homeDir: string = os.homedir()): boolean {
  try {
    return fs.statSync(credentialsPath(homeDir)).size > 0;
  } catch {
    return false;
  }
}

export function listChatDirs(chatsDir: string): string[] {
  try {
    return fs
      .readdirSync(chatsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function readJsonFile<T>(file: string): T | null {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Half-flushed write — the caller polls again.
    return null;
  }
}

export function readChatMessages(chatDir: string): FreebuffMessage[] | null {
  const parsed = readJsonFile<unknown>(path.join(chatDir, "chat-messages.json"));
  if (!Array.isArray(parsed)) return null;
  return parsed.filter(
    (item): item is FreebuffMessage =>
      typeof item === "object" && item !== null && typeof (item as FreebuffMessage).id === "string",
  );
}

export function readRunState(chatDir: string): FreebuffRunState | null {
  return readJsonFile<FreebuffRunState>(path.join(chatDir, "run-state.json"));
}

export function readChatMeta(chatDir: string): FreebuffChatMeta | null {
  return readJsonFile<FreebuffChatMeta>(path.join(chatDir, "chat-meta.json"));
}

/** Raw text of `log.jsonl`. Returns "" when absent — it appears a beat after launch. */
export function readLogText(chatDir: string): string {
  try {
    return fs.readFileSync(path.join(chatDir, "log.jsonl"), "utf8");
  } catch {
    return "";
  }
}

export interface FreebuffLogEntry {
  level?: string;
  timestamp?: string;
  msg?: string;
}

export function parseLogEntries(logText: string): FreebuffLogEntry[] {
  const entries: FreebuffLogEntry[] = [];
  for (const line of logText.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as FreebuffLogEntry;
      if (typeof parsed === "object" && parsed !== null) entries.push(parsed);
    } catch {
      // Freebuff writes this file line-by-line; a torn tail line is normal.
    }
  }
  return entries;
}

/**
 * Choose which newly-created chat directory belongs to this run.
 *
 * `before` is the set of directory names captured immediately before launch.
 * When several appear (concurrent runs in same-named workspaces — the basename
 * collision above), prefer the one whose recorded first prompt matches ours,
 * then fall back to the newest name (the names are ISO timestamps, so a
 * lexicographic sort is chronological).
 */
export function pickNewChatDir(
  chatsDir: string,
  before: ReadonlySet<string>,
  promptFirstLine?: string,
): string | null {
  const fresh = listChatDirs(chatsDir).filter((name) => !before.has(name));
  if (fresh.length === 0) return null;
  if (fresh.length > 1 && promptFirstLine) {
    const needle = promptFirstLine.trim().slice(0, 40);
    for (const name of fresh) {
      const meta = readChatMeta(path.join(chatsDir, name));
      const firstPrompt = typeof meta?.firstPrompt === "string" ? meta.firstPrompt : "";
      if (needle && firstPrompt.includes(needle)) return path.join(chatsDir, name);
    }
  }
  return path.join(chatsDir, fresh[fresh.length - 1]!);
}
