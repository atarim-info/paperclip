import { describe, expect, it } from "vitest";
import {
  type,
  label,
  isValidKiloModelId,
  DEFAULT_KILO_LOCAL_MODEL,
} from "./index.js";

describe("kilocode-local identity", () => {
  it("has the right type and label", () => {
    expect(type).toBe("kilocode_local");
    expect(label).toBe("Kilo Code (local)");
  });
});

describe("isValidKiloModelId", () => {
  it("accepts kilo/<provider>/<model> ids including ~alias providers", () => {
    expect(isValidKiloModelId("kilo/anthropic/claude-haiku-4.5")).toBe(true);
    expect(isValidKiloModelId("kilo/~openai/gpt-latest")).toBe(true);
    expect(isValidKiloModelId(DEFAULT_KILO_LOCAL_MODEL)).toBe(true);
  });

  it("rejects non-kilo, virtual, and malformed ids", () => {
    expect(isValidKiloModelId("anthropic/claude-haiku-4.5")).toBe(false);
    expect(isValidKiloModelId("kilo-auto/small")).toBe(false);
    expect(isValidKiloModelId("kilo/anthropic")).toBe(false);
    expect(isValidKiloModelId("")).toBe(false);
    expect(isValidKiloModelId(42)).toBe(false);
  });
});
