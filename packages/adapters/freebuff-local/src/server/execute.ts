import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  asNumber,
  asString,
  buildPaperclipEnv,
  joinPromptSections,
  renderPaperclipWakePrompt,
  renderTemplate,
  DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE,
} from "@paperclipai/adapter-utils/server-utils";
import { freebuffProjectChatsDir, hasFreebuffCredentials } from "./chat-store.js";
import { bracketPaste, spawnFreebuffPty } from "./pty.js";
import { watchFreebuffRun } from "./watch.js";
import { outcomeExitCode, type FreebuffOutcome } from "./terminal.js";
import { DEFAULT_FREEBUFF_COMMAND, DEFAULT_FREEBUFF_MODEL } from "../index.js";

/**
 * Runs a Paperclip task through the Freebuff CLI.
 *
 * Local execution only — driving a TUI over a remote transport is a separate
 * problem, so this adapter deliberately omits the remote/sandbox branch the
 * other `*-local` adapters carry.
 */

const DEFAULT_TIMEOUT_SEC = 1800;
const DEFAULT_READY_TIMEOUT_MS = 45_000;
const DEFAULT_PROMPT_DELAY_MS = 6_000;
const DEFAULT_PROMPT_GRACE_MS = 30_000;
const DEFAULT_POLL_INTERVAL_MS = 500;

/** Outcomes that mean "not our fault, may succeed later". */
const QUOTA_OUTCOMES: ReadonlySet<FreebuffOutcome> = new Set(["no_session", "session_expired"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const config = ctx.config ?? {};
  const context = ctx.context ?? {};
  const command = asString(config.command, DEFAULT_FREEBUFF_COMMAND);
  const homeDir = asString(config.homeDir, os.homedir());

  const cwd = asString(config.cwd, asString(context.paperclipWorkspace, ""));
  if (!cwd || !path.isAbsolute(cwd)) {
    return failure({
      errorMessage: `Freebuff needs an absolute workspace directory; got ${JSON.stringify(cwd)}.`,
      outcome: "exited_early",
    });
  }
  if (!fs.existsSync(cwd)) {
    return failure({ errorMessage: `Workspace directory does not exist: ${cwd}`, outcome: "exited_early" });
  }

  // Freebuff's login is interactive. Fail fast instead of hanging forever on a
  // login screen we have no way to complete.
  if (!hasFreebuffCredentials(homeDir)) {
    return failure({
      errorMessage:
        "Freebuff is not logged in (no ~/.config/manicode/credentials.json). Run `freebuff login` on this host as the Paperclip user.",
      outcome: "exited_early",
    });
  }

  const prompt = buildPrompt(ctx);
  if (!prompt.trim()) {
    return failure({
      errorMessage: "Refusing to start Freebuff with an empty prompt.",
      outcome: "exited_early",
    });
  }

  const timeoutSec = asNumber(config.timeoutSec, DEFAULT_TIMEOUT_SEC);
  const env = { ...currentEnv(), ...buildPaperclipEnv(ctx.agent) };
  const chatsDir = freebuffProjectChatsDir(cwd, homeDir);
  const pty = spawnFreebuffPty({ command, cwd, env });

  if (ctx.onSpawn && pty.pid > 0) {
    await ctx.onSpawn({
      pid: pty.pid,
      processGroupId: pty.pid,
      startedAt: new Date().toISOString(),
    });
  }

  try {
    const result = await watchFreebuffRun({
      chatsDir,
      prompt,
      pty,
      emit: (chunk) => ctx.onLog("stdout", chunk),
      now: () => Date.now(),
      sleep,
      framePrompt: bracketPaste,
      timeoutMs: timeoutSec > 0 ? timeoutSec * 1000 : Number.MAX_SAFE_INTEGER,
      readyTimeoutMs: asNumber(config.readyTimeoutMs, DEFAULT_READY_TIMEOUT_MS),
      promptDelayMs: asNumber(config.promptDelayMs, DEFAULT_PROMPT_DELAY_MS),
      promptGraceMs: asNumber(config.promptGraceMs, DEFAULT_PROMPT_GRACE_MS),
      pollIntervalMs: asNumber(config.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS),
    });

    const conversationId = result.chatDir ? path.basename(result.chatDir) : null;
    return {
      exitCode: outcomeExitCode(result.outcome),
      signal: null,
      timedOut: result.outcome === "timed_out",
      errorMessage: result.outcome === "completed" ? null : result.reason,
      errorFamily: QUOTA_OUTCOMES.has(result.outcome) ? "provider_quota" : null,
      errorCode: result.outcome === "completed" ? null : `freebuff_${result.outcome}`,
      errorMeta: {
        outcome: result.outcome,
        chatDir: result.chatDir,
        eventCount: result.eventCount,
        bytesPainted: result.bytesPainted,
        retryable: result.retryable,
      },
      // Freebuff exposes no token accounting, so usage and cost stay unknown.
      model: asString(config.model, DEFAULT_FREEBUFF_MODEL),
      provider: "freebuff",
      biller: "freebuff",
      costUsd: null,
      sessionParams: conversationId ? { conversationId, cwd } : null,
      sessionDisplayId: conversationId,
      summary: result.summary,
    };
  } finally {
    await pty.dispose();
  }
}

function currentEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") env[key] = value;
  }
  return env;
}

function buildPrompt(ctx: AdapterExecutionContext): string {
  const context = ctx.context ?? {};
  const promptTemplate = asString(ctx.config?.promptTemplate, DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE);
  const templateData = {
    agentId: ctx.agent.id,
    companyId: ctx.agent.companyId,
    runId: ctx.runId,
    company: { id: ctx.agent.companyId },
    agent: ctx.agent,
    run: { id: ctx.runId, source: "on_demand" },
    context,
  };
  const wakePrompt = renderPaperclipWakePrompt(context.paperclipWake, { resumedSession: false });
  const sessionHandoffNote = asString(context.paperclipSessionHandoffMarkdown, "").trim();
  return joinPromptSections([
    wakePrompt,
    sessionHandoffNote,
    renderTemplate(promptTemplate, templateData),
  ]);
}

function failure(input: { errorMessage: string; outcome: FreebuffOutcome }): AdapterExecutionResult {
  return {
    exitCode: 1,
    signal: null,
    timedOut: false,
    errorMessage: input.errorMessage,
    errorCode: `freebuff_${input.outcome}`,
    errorMeta: { outcome: input.outcome },
    summary: null,
  };
}
