import path from "node:path";
import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import {
  asNumber,
  asString,
  ensurePathInEnv,
  parseObject,
} from "@paperclipai/adapter-utils/server-utils";
import {
  describeAdapterExecutionTarget,
  ensureAdapterExecutionTargetCommandResolvable,
  ensureAdapterExecutionTargetDirectory,
  resolveAdapterExecutionTargetCwd,
  runAdapterExecutionTargetProcess,
} from "@paperclipai/adapter-utils/execution-target";
import { ensureCrushModelConfiguredAndAvailable, requireCrushModel } from "./models.js";
import { buildCrushRunArgs } from "./crush-args.js";
import { parseCrushRunSummary } from "./parse.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !/^\s*(ERROR|WARN|INFO)\s*$/i.test(line)) ?? ""
  );
}

function summarizeProbeDetail(stdout: string, stderr: string): string | null {
  const raw = firstNonEmptyLine(stderr) || firstNonEmptyLine(stdout);
  if (!raw) return null;
  const clean = raw.replace(/\s+/g, " ").trim();
  const max = 240;
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

function normalizeEnv(input: unknown): Record<string, string> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return {};
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === "string") env[key] = value;
  }
  return env;
}

// Crush doesn't (yet) publish a stable, documented error string for "no
// provider configured" — this pattern is a best-effort net over the wording
// we've observed/expect from Crush and its underlying Catwalk provider
// registry. Local process only: since this adapter never configures a
// provider on the user's behalf, a probe that fails for auth reasons is a
// user action item, not an adapter/environment defect.
//
// Deliberately narrow: only high-confidence "provider not configured / not
// logged in" phrasing matches here. Generic terms like "unauthorized" or a
// bare "authentication required/failed" are intentionally excluded — they
// can show up in unrelated failures (a network 401, an unrelated subsystem
// error) and would otherwise downgrade a genuine environment/adapter defect
// from `error` to `warn`, masking the very problem this probe exists to
// catch. When in doubt, prefer `error` over `warn`.
const CRUSH_AUTH_REQUIRED_RE =
  /(?:no\s+providers?\s+configured|provider\b[^.\n]{0,40}\bnot\s+configured|not\s+logged\s+in|no\s+(?:api\s*key|credentials)|missing\s+api\s*key|invalid\s*api\s*key|api\s*key\s+(?:is\s+)?(?:missing|invalid|required|not\s+set)|please\s+(?:configure|set)\s+(?:an?\s+)?(?:api\s*key|provider)|crush\s+(?:auth\s+)?login)/i;

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "crush");
  const target = ctx.executionTarget ?? null;
  const targetIsRemote = target?.kind === "remote";
  const cwd = resolveAdapterExecutionTargetCwd(target, asString(config.cwd, ""), process.cwd());
  const targetLabel = targetIsRemote
    ? ctx.environmentName ?? describeAdapterExecutionTarget(target)
    : null;
  const runId = `crush-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  if (targetLabel) {
    checks.push({
      code: "crush_environment_target",
      level: "info",
      message: `Probing inside environment: ${targetLabel}`,
    });
  }

  try {
    await ensureAdapterExecutionTargetDirectory(runId, target, cwd, {
      cwd,
      env: {},
      createIfMissing: false,
    });
    checks.push({
      code: "crush_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "crush_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid working directory",
      detail: cwd,
    });
  }

  const env = normalizeEnv(config.env);
  const runtimeEnv = normalizeEnv(ensurePathInEnv({ ...process.env, ...env }));

  const cwdInvalid = checks.some((check) => check.code === "crush_cwd_invalid");
  if (cwdInvalid) {
    checks.push({
      code: "crush_command_skipped",
      level: "warn",
      message: "Skipped command check because working directory validation failed.",
      detail: command,
    });
  } else {
    try {
      await ensureAdapterExecutionTargetCommandResolvable(command, target, cwd, runtimeEnv);
      checks.push({
        code: "crush_command_resolvable",
        level: "info",
        message: `Command is executable: ${command}`,
      });
    } catch (err) {
      checks.push({
        code: "crush_command_unresolvable",
        level: "error",
        message: err instanceof Error ? err.message : "Command is not executable",
        detail: command,
      });
    }
  }

  const canRunProbe =
    checks.every((check) => check.code !== "crush_cwd_invalid" && check.code !== "crush_command_unresolvable");

  const configuredModel = requireCrushModel(config.model);
  let modelValidationPassed = true;

  if (!configuredModel) {
    // Crush's model is optional: when none is configured, Crush falls back to
    // its own configured default, so this is informational, not a failure.
    checks.push({
      code: "crush_model_not_configured",
      level: "info",
      message: "No model configured; Crush will use its own default.",
    });
  } else if (targetIsRemote) {
    // Model discovery/validation shells out to a local child process against
    // Crush's `models` subcommand; it is not yet wired through the execution
    // target. When probing a remote env, skip discovery/validation here and
    // rely on the remote probe below (routed through the execution target)
    // to surface model/auth issues directly.
    checks.push({
      code: "crush_model_validation_skipped_remote",
      level: "info",
      message: `Skipped local model validation; will be validated by the probe inside ${targetLabel}.`,
    });
  } else if (canRunProbe) {
    try {
      await ensureCrushModelConfiguredAndAvailable({ model: configuredModel, command, cwd, env: runtimeEnv });
      checks.push({
        code: "crush_model_configured",
        level: "info",
        message: `Configured model: ${configuredModel}`,
      });
    } catch (err) {
      modelValidationPassed = false;
      checks.push({
        code: "crush_model_invalid",
        level: "error",
        message: err instanceof Error ? err.message : "Configured model is unavailable.",
        hint: "Run `crush models` and choose a currently available provider/model ID.",
      });
    }
  }

  if (canRunProbe && modelValidationPassed) {
    const dataDir = path.join(cwd, ".crush");
    const args = buildCrushRunArgs({ cwd, dataDir, model: configuredModel, extraArgs: [] });

    // Sandbox bridges add cold-start and transport overhead; give remote
    // probes more headroom than local ones.
    const probeTimeoutSec = Math.max(1, asNumber(config.helloProbeTimeoutSec, targetIsRemote ? 90 : 60));

    try {
      const probe = await runAdapterExecutionTargetProcess(runId, target, command, args, {
        cwd,
        env: runtimeEnv,
        timeoutSec: probeTimeoutSec,
        graceSec: 5,
        stdin: "reply with the single word: ok",
        onLog: async () => {},
      });

      const authEvidence = `${probe.stdout}\n${probe.stderr}`.trim();
      const detail = summarizeProbeDetail(probe.stdout, probe.stderr);

      if (probe.timedOut) {
        checks.push({
          code: "crush_probe_timed_out",
          level: "warn",
          message: "Crush probe timed out.",
          hint: "Retry the probe. If this persists, run Crush manually in this working directory.",
        });
      } else if ((probe.exitCode ?? 1) === 0) {
        const summary = parseCrushRunSummary(probe.stdout);
        checks.push({
          code: "crush_probe_passed",
          level: "info",
          message: "Crush probe succeeded.",
          ...(summary ? { detail: summary.replace(/\s+/g, " ").trim().slice(0, 240) } : {}),
        });
      } else if (CRUSH_AUTH_REQUIRED_RE.test(authEvidence)) {
        // Local process only: this adapter never configures a provider on
        // the user's behalf, so an auth failure here is a user action item,
        // not an environment defect.
        const heuristicNote =
          "Classified as a provider-auth issue by a best-effort heuristic (not yet verified against real Crush CLI output); if this looks wrong, treat it as a failure.";
        checks.push({
          code: "crush_probe_auth_required",
          level: "warn",
          message: "Crush is installed, but provider authentication is not ready.",
          detail: detail ? `${heuristicNote} ${detail}` : heuristicNote,
          hint: "Run `crush login` or configure a provider, then retry the probe.",
        });
      } else {
        checks.push({
          code: "crush_probe_failed",
          level: "error",
          message: "Crush probe failed.",
          ...(detail ? { detail } : {}),
          hint: "Run `crush run --quiet` manually in this working directory to debug.",
        });
      }
    } catch (err) {
      checks.push({
        code: "crush_probe_failed",
        level: "error",
        message: "Crush probe failed.",
        detail: err instanceof Error ? err.message : String(err),
        hint: "Run `crush run --quiet` manually in this working directory to debug.",
      });
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
