import { describe, expect, it } from "vitest";
import {
  type,
  label,
  isValidMimoModelId,
  DEFAULT_MIMO_LOCAL_MODEL,
} from "./index.js";

describe("mimo-local identity", () => {
  it("has the right type and label", () => {
    expect(type).toBe("mimo_local");
    expect(label).toBe("MiMo (local)");
  });
});

describe("isValidMimoModelId", () => {
  it("accepts provider/model ids including the virtual auto router", () => {
    expect(isValidMimoModelId("xiaomi/mimo-v2.5-pro")).toBe(true);
    expect(isValidMimoModelId("mimo/mimo-auto")).toBe(true);
    expect(isValidMimoModelId(DEFAULT_MIMO_LOCAL_MODEL)).toBe(true);
  });

  it("rejects malformed ids", () => {
    expect(isValidMimoModelId("xiaomi")).toBe(false);
    expect(isValidMimoModelId("/model")).toBe(false);
    expect(isValidMimoModelId("provider/")).toBe(false);
    expect(isValidMimoModelId("")).toBe(false);
    expect(isValidMimoModelId(42)).toBe(false);
  });
});
