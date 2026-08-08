import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
  AdapterEnvironmentTestStatus,
} from "@paperclipai/adapter-utils";
import { asString } from "@paperclipai/adapter-utils/server-utils";
import { credentialsPath, hasFreebuffCredentials } from "./chat-store.js";
import { type } from "../index.js";
import { resolveFreebuffRunConfig } from "../config.js";

/** Probes everything a Freebuff run depends on, without consuming a session. */
export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const config = ctx.config ?? {};
  // Resolve exactly as execute() does, so this probes what a run would use.
  const { command, ptyLauncher } = resolveFreebuffRunConfig(
    config,
    typeof process === "undefined" ? {} : process.env,
  );
  const homeDir = asString(config.homeDir, os.homedir());
  const checks: AdapterEnvironmentCheck[] = [];

  const cwd = asString(config.cwd, "");
  if (!cwd) {
    checks.push({ code: "workspace", level: "error", message: "No workspace directory configured (cwd)." });
  } else if (!path.isAbsolute(cwd)) {
    checks.push({ code: "workspace", level: "error", message: `Workspace must be absolute: ${cwd}` });
  } else if (!fs.existsSync(cwd)) {
    checks.push({ code: "workspace", level: "error", message: `Workspace does not exist: ${cwd}` });
  } else {
    checks.push({ code: "workspace", level: "info", message: `Workspace ${cwd} exists.` });
  }

  // The PTY allocator. Without it there is no way to run Freebuff at all.
  const launcher = await probe(ptyLauncher, ["--version"]);
  checks.push(
    launcher.ok
      ? { code: "pty_launcher", level: "info", message: `${ptyLauncher} available for PTY allocation.` }
      : {
          code: "pty_launcher",
          level: "error",
          message: `${ptyLauncher} not found; it is required to give Freebuff a terminal.`,
          hint: "Install util-linux (provides script(1)), or set PAPERCLIP_FREEBUFF_PTY_LAUNCHER to its path.",
        },
  );

  const version = await probe(command, ["--version"]);
  checks.push(
    version.ok
      ? {
          code: "freebuff_command",
          level: "info",
          message: `${command} resolved.`,
          detail: version.output.trim().slice(0, 200) || null,
        }
      : {
          code: "freebuff_command",
          level: "error",
          message: `${command} could not be run.`,
          detail: version.output.trim().slice(0, 300) || null,
          hint: "Install with `npm install -g freebuff`, or set PAPERCLIP_FREEBUFF_COMMAND to its path.",
        },
  );

  checks.push(
    hasFreebuffCredentials(homeDir)
      ? { code: "freebuff_auth", level: "info", message: "Freebuff credentials present." }
      : {
          code: "freebuff_auth",
          level: "error",
          message: `Not logged in (${credentialsPath(homeDir)} missing).`,
          hint: "Run `freebuff login` as the Paperclip user.",
        },
  );

  // Always warn: these are properties of the product, not of this machine.
  checks.push({
    code: "freebuff_free_tier",
    level: "warn",
    message: "Freebuff is ad-supported and session-limited.",
    detail:
      "Its terms allow prompts, code and repository data to be analysed for ad personalisation and possibly AI training. Limited mode allows 6 one-hour sessions per day; a run outliving its session is cut off. No token or cost accounting is reported.",
  });

  return {
    adapterType: type,
    status: worstStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}

function worstStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestStatus {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function probe(command: string, args: string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    let output = "";
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve({ ok, output });
    };
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      finish(false);
      return;
    }
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // already gone
      }
      finish(false);
    }, 15_000);
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", () => {
      clearTimeout(timer);
      finish(false);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      finish(code === 0);
    });
  });
}
