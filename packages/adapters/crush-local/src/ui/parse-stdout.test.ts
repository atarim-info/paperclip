import { describe, expect, it } from "vitest";
import { parseCrushStdoutLine } from "./parse-stdout.js";

describe("parseCrushStdoutLine", () => {
  it("emits an assistant entry for non-empty plain text", () => {
    expect(parseCrushStdoutLine("Hello", "t0")).toEqual([{ kind: "assistant", ts: "t0", text: "Hello" }]);
  });
  it("drops blank lines", () => {
    expect(parseCrushStdoutLine("   ", "t0")).toEqual([]);
  });
});
