import { describe, expect, it } from "vitest";
import { diffTranscript, summarizeTranscript } from "./transcript.js";
import type { FreebuffMessage } from "./chat-store.js";

// Shapes below mirror a real chat-messages.json captured from freebuff 0.0.142.
const divider: FreebuffMessage = {
  id: "divider-1",
  variant: "ai",
  content: "",
  blocks: [{ type: "mode-divider", mode: "full" }],
  timestamp: "07:53 PM",
};

const userMessage: FreebuffMessage = {
  id: "user-1",
  variant: "user",
  content: "master the n8n workflow",
  blocks: [],
  timestamp: "07:53 PM",
};

const aiMessage: FreebuffMessage = {
  id: "ai-1",
  variant: "ai",
  content: "",
  timestamp: "07:53 PM",
  blocks: [
    { type: "text", content: "Looking at the workflows.", textType: "normal" },
    { type: "tool", toolName: "read_files" },
    { type: "agent", agentType: "basher", status: "complete", content: "" },
    { type: "text", content: "Reasoning about it.", textType: "thinking" },
  ],
};

describe("diffTranscript", () => {
  it("maps each block type to an event", () => {
    const diff = diffTranscript([divider, userMessage, aiMessage]);
    expect(diff.events.map((event) => event.t)).toEqual([
      "mode",
      "status", // user prompt accepted
      "text",
      "tool",
      "agent",
      "text",
    ]);
    expect(diff.userMessageCount).toBe(1);
    expect(diff.sawAskUser).toBe(false);
  });

  it("marks thinking text so the viewer can dim it", () => {
    const diff = diffTranscript([aiMessage]);
    const thinking = diff.events.filter((event) => event.t === "text" && event.thinking);
    expect(thinking).toHaveLength(1);
  });

  it("emits nothing new when the file is re-read unchanged", () => {
    const first = diffTranscript([divider, userMessage, aiMessage]);
    const second = diffTranscript([divider, userMessage, aiMessage], first.cursor);
    expect(second.events).toEqual([]);
  });

  it("emits only appended blocks as the run progresses", () => {
    const first = diffTranscript([aiMessage]);
    const grown: FreebuffMessage = {
      ...aiMessage,
      blocks: [...(aiMessage.blocks ?? []), { type: "tool", toolName: "write_file" }],
    };
    const second = diffTranscript([grown], first.cursor);
    expect(second.events).toEqual([
      { t: "tool", ts: "07:53 PM", tool: "write_file" },
    ]);
  });

  it("flags ask-user, which strands an unattended run", () => {
    const asked: FreebuffMessage = {
      ...aiMessage,
      blocks: [{ type: "ask-user" }],
    };
    expect(diffTranscript([asked]).sawAskUser).toBe(true);
  });

  it("skips blocks with no usable payload", () => {
    const empty: FreebuffMessage = {
      id: "ai-2",
      variant: "ai",
      blocks: [{ type: "text", content: "   " }, { type: "unknown-future-block" }],
    };
    expect(diffTranscript([empty]).events).toEqual([]);
  });
});

describe("summarizeTranscript", () => {
  it("returns the last assistant text block", () => {
    expect(summarizeTranscript([userMessage, aiMessage])).toBe("Reasoning about it.");
  });

  it("returns null when the agent never spoke", () => {
    expect(summarizeTranscript([userMessage])).toBeNull();
  });
});
