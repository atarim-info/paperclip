export interface CrushRunArgsInput {
  cwd: string;
  dataDir: string;
  model?: string | null;
  smallModel?: string | null;
  sessionId?: string | null;
  extraArgs?: string[];
}

// `crush run -m` accepts either a bare model name or a `provider/model` string,
// but in practice some provider/model IDs (e.g. `zhipu-coding/glm-5.2`) fail at
// runtime while the bare model name (`glm-5.2`) succeeds. Normalize to the
// bare model name for the `-m` flag while preserving the full id elsewhere.
function crushRunModel(model: string): string {
  const slash = model.indexOf("/");
  return slash >= 0 ? model.slice(slash + 1) : model;
}

// Non-interactive `crush run` proceeds headlessly without any permission
// flag; `--yolo` is TUI-only and is rejected by `run` ("Unknown flag: --yolo").
export function buildCrushRunArgs(input: CrushRunArgsInput): string[] {
  const args = ["run", "--quiet", "-c", input.cwd, "-D", input.dataDir];
  if (input.sessionId) args.push("-s", input.sessionId);
  if (input.model) args.push("-m", crushRunModel(input.model));
  if (input.smallModel) args.push("--small-model", input.smallModel);
  if (input.extraArgs && input.extraArgs.length > 0) args.push(...input.extraArgs);
  return args;
}

export function buildCrushSessionListArgs(input: { cwd: string; dataDir: string }): string[] {
  return ["session", "list", "--json", "-c", input.cwd, "-D", input.dataDir];
}
