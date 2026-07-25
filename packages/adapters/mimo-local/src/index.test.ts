import { describe, expect, it } from "vitest";
import {
  type,
  label,
  isValidMimoModelId,
  DEFAULT_MIMO_LOCAL_MODEL,
  DEFAULT_MIMO_CHEAP_MODEL,
  buildMimoModelProfiles,
  modelProfiles,
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

describe("buildMimoModelProfiles cheap lane", () => {
  it("defaults to the MiMo cheap model", () => {
    const [cheap] = buildMimoModelProfiles({});
    expect(cheap.key).toBe("cheap");
    expect(cheap.adapterConfig).toEqual({ model: DEFAULT_MIMO_CHEAP_MODEL });
    expect(modelProfiles.find((p) => p.key === "cheap")).toBeTruthy();
  });

  it("uses PAPERCLIP_MIMO_CHEAP_MODEL when set", () => {
    const [cheap] = buildMimoModelProfiles({ PAPERCLIP_MIMO_CHEAP_MODEL: "xiaomi/gw" });
    expect(cheap.adapterConfig).toEqual({ model: "xiaomi/gw" });
  });

  it("falls back to PAPERCLIP_MIMO_SMALL_MODEL so one setting covers both budget lanes", () => {
    const [cheap] = buildMimoModelProfiles({ PAPERCLIP_MIMO_SMALL_MODEL: "xiaomi/small" });
    expect(cheap.adapterConfig).toEqual({ model: "xiaomi/small" });
  });

  it("prefers CHEAP_MODEL over SMALL_MODEL when both are set", () => {
    const [cheap] = buildMimoModelProfiles({
      PAPERCLIP_MIMO_CHEAP_MODEL: "xiaomi/cheap",
      PAPERCLIP_MIMO_SMALL_MODEL: "xiaomi/small",
    });
    expect(cheap.adapterConfig).toEqual({ model: "xiaomi/cheap" });
  });
});
