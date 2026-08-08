import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  freebuffProjectChatsDir,
  hasFreebuffCredentials,
  listChatDirs,
  parseLogEntries,
  pickNewChatDir,
  readChatMessages,
  readRunState,
} from "./chat-store.js";

let home: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "freebuff-store-"));
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

function makeChat(project: string, name: string, files: Record<string, string> = {}): string {
  const dir = path.join(home, ".config", "manicode", "projects", project, "chats", name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, file), content);
  return dir;
}

describe("freebuffProjectChatsDir", () => {
  it("keys the project directory on the workspace basename", () => {
    expect(freebuffProjectChatsDir("/home/u/develop/utms", home)).toBe(
      path.join(home, ".config", "manicode", "projects", "utms", "chats"),
    );
  });

  it("collapses distinct checkouts that share a basename", () => {
    // Freebuff's own behaviour, not ours — pickNewChatDir compensates.
    expect(freebuffProjectChatsDir("/a/utms", home)).toBe(freebuffProjectChatsDir("/b/utms", home));
  });
});

describe("readers", () => {
  it("returns null for missing, empty and half-written files", () => {
    const dir = makeChat("demo", "chat-1", {
      "chat-messages.json": '[{"id":"ai-1","variant":"ai","bloc',
      "run-state.json": "",
    });
    expect(readChatMessages(dir)).toBeNull();
    expect(readRunState(dir)).toBeNull();
    expect(readChatMessages(path.join(dir, "nope"))).toBeNull();
  });

  it("drops entries that are not messages", () => {
    const dir = makeChat("demo", "chat-1", {
      "chat-messages.json": JSON.stringify([{ id: "ai-1", variant: "ai" }, null, 42, { variant: "ai" }]),
    });
    expect(readChatMessages(dir)).toEqual([{ id: "ai-1", variant: "ai" }]);
  });

  it("parses whole log lines and ignores a torn tail", () => {
    expect(parseLogEntries('{"msg":"a"}\n{"msg":"b"}\n{"ms')).toEqual([{ msg: "a" }, { msg: "b" }]);
  });
});

describe("hasFreebuffCredentials", () => {
  it("is false when absent and true when present", () => {
    expect(hasFreebuffCredentials(home)).toBe(false);
    const file = path.join(home, ".config", "manicode", "credentials.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{"token":"x"}');
    expect(hasFreebuffCredentials(home)).toBe(true);
  });
});

describe("pickNewChatDir", () => {
  it("returns null until a new directory appears", () => {
    makeChat("demo", "2026-08-07T10-00-00.000Z");
    const chats = freebuffProjectChatsDir("/x/demo", home);
    expect(pickNewChatDir(chats, new Set(listChatDirs(chats)))).toBeNull();
  });

  it("ignores directories that existed before the run", () => {
    makeChat("demo", "2026-08-07T10-00-00.000Z");
    const chats = freebuffProjectChatsDir("/x/demo", home);
    const before = new Set(listChatDirs(chats));
    makeChat("demo", "2026-08-07T11-00-00.000Z");
    expect(pickNewChatDir(chats, before)).toBe(path.join(chats, "2026-08-07T11-00-00.000Z"));
  });

  it("disambiguates concurrent runs by first prompt", () => {
    const chats = freebuffProjectChatsDir("/x/demo", home);
    fs.mkdirSync(chats, { recursive: true });
    const before = new Set<string>();
    makeChat("demo", "2026-08-07T11-00-00.000Z", {
      "chat-meta.json": JSON.stringify({ firstPrompt: "Fix the login bug in the auth service" }),
    });
    makeChat("demo", "2026-08-07T12-00-00.000Z", {
      "chat-meta.json": JSON.stringify({ firstPrompt: "Write release notes" }),
    });
    expect(pickNewChatDir(chats, before, "Fix the login bug in the auth service")).toBe(
      path.join(chats, "2026-08-07T11-00-00.000Z"),
    );
  });

  it("falls back to the newest directory when nothing matches", () => {
    const chats = freebuffProjectChatsDir("/x/demo", home);
    fs.mkdirSync(chats, { recursive: true });
    makeChat("demo", "2026-08-07T11-00-00.000Z");
    makeChat("demo", "2026-08-07T12-00-00.000Z");
    expect(pickNewChatDir(chats, new Set(), "unmatched prompt")).toBe(
      path.join(chats, "2026-08-07T12-00-00.000Z"),
    );
  });
});
