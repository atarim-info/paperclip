import { describe, expect, it } from "vitest";
import {
  type,
  label,
  models,
  modelProfiles,
  isValidCrushModelId,
  buildCrushModelProfiles,
  DEFAULT_CRUSH_CHEAP_MODEL,
} from "./index.js";

describe("crush-local index", () => {
  it("exposes the adapter identity", () => {
    expect(type).toBe("crush_local");
    expect(label).toBe("Crush (local)");
  });

  it("accepts plain and provider/model ids, rejects empties", () => {
    expect(isValidCrushModelId("anthropic/claude-sonnet-4-5-20250929")).toBe(true);
    expect(isValidCrushModelId("gpt-5.2")).toBe(true); // Crush accepts bare model names
    expect(isValidCrushModelId("")).toBe(false);
    expect(isValidCrushModelId("   ")).toBe(false);
    expect(isValidCrushModelId(42)).toBe(false);
  });

  it("ships a non-empty static fallback list", () => {
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.id && m.label)).toBe(true);
  });

  it("builds a cheap profile that sets the model", () => {
    expect(modelProfiles[0].key).toBe("cheap");
    expect(modelProfiles[0].adapterConfig).toEqual({ model: DEFAULT_CRUSH_CHEAP_MODEL });
  });

  it("honors PAPERCLIP_CRUSH_CHEAP_MODEL override", () => {
    const profiles = buildCrushModelProfiles({ PAPERCLIP_CRUSH_CHEAP_MODEL: "openai/gpt-5.4-mini" });
    expect(profiles[0].adapterConfig).toEqual({ model: "openai/gpt-5.4-mini" });
  });
});
