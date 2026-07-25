import { afterEach, describe, expect, it } from "vitest";
import {
  ensureKiloModelConfiguredAndAvailable,
  listKiloModels,
  requireKiloModelId,
  resetKiloModelsCacheForTests,
} from "./models.js";

describe("kilo models", () => {
  afterEach(() => {
    delete process.env.PAPERCLIP_KILO_COMMAND;
    delete process.env.KILO_ALLOW_ALL_MODELS;
    resetKiloModelsCacheForTests();
  });

  it("returns an empty list when discovery command is unavailable", async () => {
    process.env.PAPERCLIP_KILO_COMMAND = "__paperclip_missing_kilo_command__";
    await expect(listKiloModels()).resolves.toEqual([]);
  });

  it("rejects when model is missing", async () => {
    await expect(
      ensureKiloModelConfiguredAndAvailable({ model: "" }),
    ).rejects.toThrow("Kilo requires `adapterConfig.model`");
  });

  it("accepts a provider/model id without running discovery", () => {
    expect(requireKiloModelId("kilo/openai/gpt-5.2-codex")).toBe("kilo/openai/gpt-5.2-codex");
  });

  it("rejects malformed provider/model ids before discovery", () => {
    expect(() => requireKiloModelId("gpt-5.2-codex")).toThrow(
      "Kilo requires `adapterConfig.model`",
    );
    expect(() => requireKiloModelId("openai/")).toThrow(
      "Kilo requires `adapterConfig.model`",
    );
  });

  it("rejects when discovery cannot run for configured model", async () => {
    process.env.PAPERCLIP_KILO_COMMAND = "__paperclip_missing_kilo_command__";
    await expect(
      ensureKiloModelConfiguredAndAvailable({
        model: "kilo/openai/gpt-5",
      }),
    ).rejects.toThrow("Failed to start command");
  });

  it("skips the availability check when KILO_ALLOW_ALL_MODELS is set in the run env", async () => {
    process.env.PAPERCLIP_KILO_COMMAND = "__paperclip_missing_kilo_command__";
    await expect(
      ensureKiloModelConfiguredAndAvailable({
        model: "kilo/anthropic/tensorix/deepseek/deepseek-chat-v3.1",
        env: { KILO_ALLOW_ALL_MODELS: "true" },
      }),
    ).resolves.toEqual([
      { id: "kilo/anthropic/tensorix/deepseek/deepseek-chat-v3.1", label: "kilo/anthropic/tensorix/deepseek/deepseek-chat-v3.1" },
    ]);
  });

  it("honours KILO_ALLOW_ALL_MODELS from the process env", async () => {
    process.env.PAPERCLIP_KILO_COMMAND = "__paperclip_missing_kilo_command__";
    process.env.KILO_ALLOW_ALL_MODELS = "1";
    await expect(
      ensureKiloModelConfiguredAndAvailable({ model: "kilo/anthropic/gateway/some-model" }),
    ).resolves.toEqual([{ id: "kilo/anthropic/gateway/some-model", label: "kilo/anthropic/gateway/some-model" }]);
  });

  it("still enforces provider/model format when KILO_ALLOW_ALL_MODELS is set", async () => {
    await expect(
      ensureKiloModelConfiguredAndAvailable({
        model: "not-a-valid-id",
        env: { KILO_ALLOW_ALL_MODELS: "true" },
      }),
    ).rejects.toThrow("Kilo requires `adapterConfig.model`");
  });
});
