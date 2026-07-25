import { describe, expect, it } from "vitest";
import { buildCrushLocalConfig } from "./build-config.js";

describe("buildCrushLocalConfig", () => {
  it("maps model, smallModel, command and extraArgs", () => {
    const ac = buildCrushLocalConfig({
      model: "openai/gpt-5.2",
      smallModel: "anthropic/claude-haiku-4-5-20251001",
      command: "crush",
      extraArgs: "--debug, --verbose",
    } as any);
    expect(ac.model).toBe("openai/gpt-5.2");
    expect(ac.smallModel).toBe("anthropic/claude-haiku-4-5-20251001");
    expect(ac.command).toBe("crush");
    expect(ac.extraArgs).toEqual(["--debug", "--verbose"]);
  });
  it("omits model when not provided (Crush uses its default)", () => {
    const ac = buildCrushLocalConfig({} as any);
    expect(ac.model).toBeUndefined();
  });
});
