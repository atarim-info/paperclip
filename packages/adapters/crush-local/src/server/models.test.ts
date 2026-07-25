import { afterEach, describe, expect, it } from "vitest";
import { parseCrushModelsOutput, requireCrushModel, resetCrushModelsCacheForTests } from "./models.js";

afterEach(() => resetCrushModelsCacheForTests());

describe("parseCrushModelsOutput", () => {
  it("parses provider/model lines and keeps nested model paths", () => {
    const out = [
      "anthropic/claude-sonnet-4-5-20250929",
      "openai/gpt-5.2",
      "aihubmix/ByteDance-Seed/Seed-OSS-36B-Instruct",
      "", // blank
      "not-a-model-line",
    ].join("\n");
    const models = parseCrushModelsOutput(out);
    expect(models.map((m) => m.id)).toEqual([
      "anthropic/claude-sonnet-4-5-20250929",
      "openai/gpt-5.2",
      "aihubmix/ByteDance-Seed/Seed-OSS-36B-Instruct",
    ]);
  });

  it("dedupes repeated ids", () => {
    const models = parseCrushModelsOutput("openai/gpt-5.2\nopenai/gpt-5.2");
    expect(models).toHaveLength(1);
  });
});

describe("requireCrushModel", () => {
  it("returns the trimmed model when valid", () => {
    expect(requireCrushModel("  openai/gpt-5.2 ")).toBe("openai/gpt-5.2");
  });
  it("returns null when absent (model is optional for Crush)", () => {
    expect(requireCrushModel(undefined)).toBeNull();
    expect(requireCrushModel("")).toBeNull();
  });
});
