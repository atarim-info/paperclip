import { describe, expect, it } from "vitest";
import {
  type,
  label,
  isValidKiloModelId,
  DEFAULT_KILO_LOCAL_MODEL,
  DEFAULT_KILO_CHEAP_MODEL,
  buildKiloModelProfiles,
  modelProfiles,
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

describe("buildKiloModelProfiles cheap lane", () => {
  it("defaults to the Kilo cheap model", () => {
    const [cheap] = buildKiloModelProfiles({});
    expect(cheap.key).toBe("cheap");
    expect(cheap.adapterConfig).toEqual({ model: DEFAULT_KILO_CHEAP_MODEL });
    expect(modelProfiles.find((p) => p.key === "cheap")).toBeTruthy();
  });

  it("uses PAPERCLIP_KILO_CHEAP_MODEL when set", () => {
    const [cheap] = buildKiloModelProfiles({ PAPERCLIP_KILO_CHEAP_MODEL: "kilo/anthropic/gw" });
    expect(cheap.adapterConfig).toEqual({ model: "kilo/anthropic/gw" });
  });

  it("falls back to PAPERCLIP_KILO_SMALL_MODEL so one setting covers both budget lanes", () => {
    const [cheap] = buildKiloModelProfiles({ PAPERCLIP_KILO_SMALL_MODEL: "kilo/anthropic/small" });
    expect(cheap.adapterConfig).toEqual({ model: "kilo/anthropic/small" });
  });

  it("prefers CHEAP_MODEL over SMALL_MODEL when both are set", () => {
    const [cheap] = buildKiloModelProfiles({
      PAPERCLIP_KILO_CHEAP_MODEL: "kilo/anthropic/cheap",
      PAPERCLIP_KILO_SMALL_MODEL: "kilo/anthropic/small",
    });
    expect(cheap.adapterConfig).toEqual({ model: "kilo/anthropic/cheap" });
  });
});
