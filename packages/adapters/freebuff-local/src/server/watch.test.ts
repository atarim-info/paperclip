import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { watchFreebuffRun, type FreebuffWatchDeps } from "./watch.js";
import { parseFreebuffEvent } from "../events.js";

/**
 * Drives the whole run loop against a fake terminal and a real (temp) chat
 * store, with a virtual clock — so a "30 second" run finishes instantly.
 */

let chatsDir: string;

beforeEach(() => {
  chatsDir = fs.mkdtempSync(path.join(os.tmpdir(), "freebuff-watch-"));
});

afterEach(() => {
  fs.rmSync(chatsDir, { recursive: true, force: true });
});

const SESSION_OVER = JSON.stringify({
  level: "INFO",
  msg: "[chat-runtime] Freebuff session over; holding queued messages until rejoin",
});

function writeChat(name: string, files: Record<string, string>): string {
  const dir = path.join(chatsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, file), content);
  return dir;
}

interface Harness {
  deps: FreebuffWatchDeps;
  emitted: string[];
  typed: string[];
  submits: number;
}

function harness(overrides: Partial<FreebuffWatchDeps> = {}, onTick?: (elapsed: number) => void): Harness {
  const emitted: string[] = [];
  const typed: string[] = [];
  let submits = 0;
  let clock = 0;
  const state = { exited: false };

  const deps: FreebuffWatchDeps = {
    chatsDir,
    prompt: "Fix the login bug",
    pty: {
      write: (text) => typed.push(text),
      submit: () => {
        submits += 1;
      },
      exited: () => state.exited,
      bytesPainted: () => 4096,
    },
    emit: async (chunk) => {
      emitted.push(chunk);
    },
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
      onTick?.(clock);
    },
    framePrompt: (text) => `<paste>${text}</paste>`,
    timeoutMs: 600_000,
    readyTimeoutMs: 45_000,
    promptDelayMs: 6_000,
    promptGraceMs: 30_000,
    pollIntervalMs: 500,
    ...overrides,
  };
  return { deps, emitted, typed, get submits() { return submits; } } as Harness;
}

function events(emitted: string[]) {
  return emitted.map((line) => parseFreebuffEvent(line)).filter(Boolean);
}

describe("watchFreebuffRun", () => {
  it("gives up when Freebuff never creates a conversation", async () => {
    const h = harness();
    const result = await watchFreebuffRun(h.deps);
    expect(result.outcome).toBe("exited_early");
    expect(result.reason).toMatch(/never created a conversation/);
  });

  it("reports the quota screen without waiting for a timeout", async () => {
    const h = harness({}, (elapsed) => {
      if (elapsed === 500) writeChat("chat-1", { "log.jsonl": SESSION_OVER });
    });
    const result = await watchFreebuffRun(h.deps);
    expect(result.outcome).toBe("no_session");
    expect(result.retryable).toBe(true);
  });

  it("types the prompt only after the conversation appears, and only once", async () => {
    const h = harness({}, (elapsed) => {
      if (elapsed === 500) writeChat("chat-1", { "log.jsonl": "" });
      if (elapsed === 10_000) {
        writeChat("chat-1", {
          "chat-messages.json": JSON.stringify([{ id: "u1", variant: "user", content: "Fix the login bug" }]),
        });
      }
      if (elapsed === 20_000) {
        writeChat("chat-1", {
          "chat-messages.json": JSON.stringify([
            { id: "u1", variant: "user", content: "Fix the login bug" },
            { id: "a1", variant: "ai", blocks: [{ type: "text", content: "Fixed it." }] },
          ]),
          "run-state.json": JSON.stringify({ output: { type: "success" } }),
        });
      }
    });

    const result = await watchFreebuffRun(h.deps);

    expect(h.typed).toEqual(["<paste>Fix the login bug</paste>"]);
    expect(result.outcome).toBe("completed");
    expect(result.summary).toBe("Fixed it.");
    expect(events(h.emitted).some((event) => event?.t === "text")).toBe(true);
  });

  it("stops as soon as Freebuff asks the user a question", async () => {
    const h = harness({}, (elapsed) => {
      if (elapsed === 500) writeChat("chat-1", { "log.jsonl": "" });
      if (elapsed === 10_000) {
        writeChat("chat-1", {
          "chat-messages.json": JSON.stringify([
            { id: "u1", variant: "user", content: "Fix the login bug" },
            { id: "a1", variant: "ai", blocks: [{ type: "ask-user" }] },
          ]),
        });
      }
    });
    const result = await watchFreebuffRun(h.deps);
    expect(result.outcome).toBe("asked_question");
    expect(result.retryable).toBe(false);
  });

  it("never re-emits a transcript block it already streamed", async () => {
    const h = harness({}, (elapsed) => {
      if (elapsed === 500) writeChat("chat-1", { "log.jsonl": "" });
      if (elapsed >= 10_000 && elapsed < 20_000) {
        writeChat("chat-1", {
          "chat-messages.json": JSON.stringify([
            { id: "u1", variant: "user", content: "Fix the login bug" },
            { id: "a1", variant: "ai", blocks: [{ type: "text", content: "Working." }] },
          ]),
        });
      }
      if (elapsed >= 20_000) {
        writeChat("chat-1", {
          "chat-messages.json": JSON.stringify([
            { id: "u1", variant: "user", content: "Fix the login bug" },
            { id: "a1", variant: "ai", blocks: [{ type: "text", content: "Working." }] },
          ]),
          "run-state.json": JSON.stringify({ output: { type: "success" } }),
        });
      }
    });
    await watchFreebuffRun(h.deps);
    const texts = events(h.emitted).filter((event) => event?.t === "text");
    expect(texts).toHaveLength(1);
  });
});
