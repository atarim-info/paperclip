import { describe, expect, it } from "vitest";
import {
  type,
  label,
  models,
  isValidCrushModelId,
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
});
