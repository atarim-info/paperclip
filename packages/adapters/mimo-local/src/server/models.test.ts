import { afterEach, describe, expect, it } from "vitest";
import {
  ensureMimoModelConfiguredAndAvailable,
  listMimoModels,
  requireMimoModelId,
  resetMimoModelsCacheForTests,
} from "./models.js";

describe("mimo models", () => {
  afterEach(() => {
    delete process.env.PAPERCLIP_MIMO_COMMAND;
    delete process.env.MIMO_ALLOW_ALL_MODELS;
    resetMimoModelsCacheForTests();
  });

  it("returns an empty list when discovery command is unavailable", async () => {
    process.env.PAPERCLIP_MIMO_COMMAND = "__paperclip_missing_mimo_command__";
    await expect(listMimoModels()).resolves.toEqual([]);
  });

  it("defers to Mimo's own default when no model is configured", async () => {
    // An unset model must NOT be an error: `mimo run` treats --model as optional
    // and picks its own default, which is what the harness TUI does. Discovery
    // must not run, so this resolves without any command being spawned.
    await expect(ensureMimoModelConfiguredAndAvailable({ model: "" })).resolves.toEqual([]);
    await expect(ensureMimoModelConfiguredAndAvailable({ model: "   " })).resolves.toEqual([]);
    await expect(ensureMimoModelConfiguredAndAvailable({})).resolves.toEqual([]);
  });

  it("accepts a provider/model id without running discovery", () => {
    expect(requireMimoModelId("openai/gpt-5.2-codex")).toBe("openai/gpt-5.2-codex");
  });

  it("rejects malformed provider/model ids before discovery", () => {
    expect(() => requireMimoModelId("gpt-5.2-codex")).toThrow(
      "Mimo requires `adapterConfig.model`",
    );
    expect(() => requireMimoModelId("openai/")).toThrow(
      "Mimo requires `adapterConfig.model`",
    );
  });

  it("rejects when discovery cannot run for configured model", async () => {
    process.env.PAPERCLIP_MIMO_COMMAND = "__paperclip_missing_mimo_command__";
    await expect(
      ensureMimoModelConfiguredAndAvailable({
        model: "openai/gpt-5",
      }),
    ).rejects.toThrow("Failed to start command");
  });

  it("skips the availability check when MIMO_ALLOW_ALL_MODELS is set in the run env", async () => {
    process.env.PAPERCLIP_MIMO_COMMAND = "__paperclip_missing_mimo_command__";
    await expect(
      ensureMimoModelConfiguredAndAvailable({
        model: "anthropic/tensorix/deepseek/deepseek-chat-v3.1",
        env: { MIMO_ALLOW_ALL_MODELS: "true" },
      }),
    ).resolves.toEqual([
      { id: "anthropic/tensorix/deepseek/deepseek-chat-v3.1", label: "anthropic/tensorix/deepseek/deepseek-chat-v3.1" },
    ]);
  });

  it("honours MIMO_ALLOW_ALL_MODELS from the process env", async () => {
    process.env.PAPERCLIP_MIMO_COMMAND = "__paperclip_missing_mimo_command__";
    process.env.MIMO_ALLOW_ALL_MODELS = "1";
    await expect(
      ensureMimoModelConfiguredAndAvailable({ model: "anthropic/gateway/some-model" }),
    ).resolves.toEqual([{ id: "anthropic/gateway/some-model", label: "anthropic/gateway/some-model" }]);
  });

  it("still enforces provider/model format when MIMO_ALLOW_ALL_MODELS is set", async () => {
    await expect(
      ensureMimoModelConfiguredAndAvailable({
        model: "not-a-valid-id",
        env: { MIMO_ALLOW_ALL_MODELS: "true" },
      }),
    ).rejects.toThrow("Mimo requires `adapterConfig.model`");
  });
});
