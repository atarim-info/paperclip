import { describe, expect, it } from "vitest";
import { ADAPTER_SESSION_MANAGEMENT } from "@paperclipai/adapter-utils/session-compaction";
import { assertFreebuffSessionIsTraceabilityOnly, sessionCodec } from "./index.js";

/**
 * The conversation id is persisted for traceability, not resume. These tests
 * pin that intent so the two halves (the codec here, and the
 * supportsSessionResume flag in adapter-utils) cannot drift apart silently.
 */
describe("freebuff session handling is traceability-only", () => {
  it("declares itself non-resumable in the shared session registry", () => {
    expect(ADAPTER_SESSION_MANAGEMENT.freebuff_local?.supportsSessionResume).toBe(false);
  });

  it("passes the guard while the flag and the implementation agree", () => {
    expect(() =>
      assertFreebuffSessionIsTraceabilityOnly(ADAPTER_SESSION_MANAGEMENT.freebuff_local),
    ).not.toThrow();
  });

  it("throws if someone flips the flag without implementing --continue", () => {
    expect(() => assertFreebuffSessionIsTraceabilityOnly({ supportsSessionResume: true })).toThrow(
      /never passes --continue/,
    );
  });

  it("round-trips the conversation id and exposes it as the display id", () => {
    const params = sessionCodec.serialize!({
      conversationId: "2026-08-07T22-34-50.066Z",
      cwd: "/srv/work",
    });
    expect(params).toMatchObject({ conversationId: "2026-08-07T22-34-50.066Z", cwd: "/srv/work" });
    expect(sessionCodec.getDisplayId!(params)).toBe("2026-08-07T22-34-50.066Z");
    expect(sessionCodec.deserialize!(params)).toMatchObject({
      conversationId: "2026-08-07T22-34-50.066Z",
    });
  });

  it("rejects a payload with no conversation id", () => {
    expect(sessionCodec.serialize!({ cwd: "/srv/work" })).toBeNull();
    expect(sessionCodec.deserialize!(null)).toBeNull();
  });
});
