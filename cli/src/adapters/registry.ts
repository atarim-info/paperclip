import type { CLIAdapterModule } from "@paperclipai/adapter-utils";
import { printClaudeStreamEvent } from "@paperclipai/adapter-claude-local/cli";
import { printCodexStreamEvent } from "@paperclipai/adapter-codex-local/cli";
import { printCursorStreamEvent } from "@paperclipai/adapter-cursor-local/cli";
import { printCursorCloudEvent } from "@paperclipai/adapter-cursor-cloud/cli";
import { printGeminiStreamEvent } from "@paperclipai/adapter-gemini-local/cli";
import { printGrokStreamEvent } from "@paperclipai/adapter-grok-local/cli";
import { formatStdoutEvent as printHermesGatewayStreamEvent } from "@paperclipai/hermes-paperclip-adapter/gateway/cli";
import { printHermesStreamEvent } from "@paperclipai/hermes-paperclip-adapter/cli";
import { printOpenCodeStreamEvent } from "@paperclipai/adapter-opencode-local/cli";
import { printCrushStreamEvent } from "@paperclipai/adapter-crush-local/cli";
import { printFreebuffStreamEvent } from "@paperclipai/adapter-freebuff-local/cli";
import { printKiloStreamEvent } from "@paperclipai/adapter-kilocode-local/cli";
import { printMimoStreamEvent } from "@paperclipai/adapter-mimo-local/cli";
import { printPiStreamEvent } from "@paperclipai/adapter-pi-local/cli";
import { printOpenClawGatewayStreamEvent } from "@paperclipai/adapter-openclaw-gateway/cli";
import { processCLIAdapter } from "./process/index.js";
import { httpCLIAdapter } from "./http/index.js";

const claudeLocalCLIAdapter: CLIAdapterModule = {
  type: "claude_local",
  formatStdoutEvent: printClaudeStreamEvent,
};

const codexLocalCLIAdapter: CLIAdapterModule = {
  type: "codex_local",
  formatStdoutEvent: printCodexStreamEvent,
};

const openCodeLocalCLIAdapter: CLIAdapterModule = {
  type: "opencode_local",
  formatStdoutEvent: printOpenCodeStreamEvent,
};

const freebuffLocalCLIAdapter: CLIAdapterModule = {
  type: "freebuff_local",
  formatStdoutEvent: printFreebuffStreamEvent,
};

const crushLocalCLIAdapter: CLIAdapterModule = {
  type: "crush_local",
  formatStdoutEvent: printCrushStreamEvent,
};

const kilocodeLocalCLIAdapter: CLIAdapterModule = {
  type: "kilocode_local",
  formatStdoutEvent: printKiloStreamEvent,
};

const mimoLocalCLIAdapter: CLIAdapterModule = {
  type: "mimo_local",
  formatStdoutEvent: printMimoStreamEvent,
};

const piLocalCLIAdapter: CLIAdapterModule = {
  type: "pi_local",
  formatStdoutEvent: printPiStreamEvent,
};

const cursorLocalCLIAdapter: CLIAdapterModule = {
  type: "cursor",
  formatStdoutEvent: printCursorStreamEvent,
};

const cursorCloudCLIAdapter: CLIAdapterModule = {
  type: "cursor_cloud",
  formatStdoutEvent: printCursorCloudEvent,
};

const geminiLocalCLIAdapter: CLIAdapterModule = {
  type: "gemini_local",
  formatStdoutEvent: printGeminiStreamEvent,
};

const grokLocalCLIAdapter: CLIAdapterModule = {
  type: "grok_local",
  formatStdoutEvent: printGrokStreamEvent,
};

const hermesGatewayCLIAdapter: CLIAdapterModule = {
  type: "hermes_gateway",
  formatStdoutEvent: printHermesGatewayStreamEvent,
};

const hermesLocalCLIAdapter: CLIAdapterModule = {
  type: "hermes_local",
  formatStdoutEvent: printHermesStreamEvent,
};

const openclawGatewayCLIAdapter: CLIAdapterModule = {
  type: "openclaw_gateway",
  formatStdoutEvent: printOpenClawGatewayStreamEvent,
};

const adaptersByType = new Map<string, CLIAdapterModule>(
  [
    claudeLocalCLIAdapter,
    codexLocalCLIAdapter,
    openCodeLocalCLIAdapter,
    crushLocalCLIAdapter,
    freebuffLocalCLIAdapter,
    kilocodeLocalCLIAdapter,
    mimoLocalCLIAdapter,
    piLocalCLIAdapter,
    cursorLocalCLIAdapter,
    cursorCloudCLIAdapter,
    geminiLocalCLIAdapter,
    grokLocalCLIAdapter,
    hermesGatewayCLIAdapter,
    hermesLocalCLIAdapter,
    openclawGatewayCLIAdapter,
    processCLIAdapter,
    httpCLIAdapter,
  ].map((a) => [a.type, a]),
);

export function getCLIAdapter(type: string): CLIAdapterModule {
  return adaptersByType.get(type) ?? processCLIAdapter;
}
