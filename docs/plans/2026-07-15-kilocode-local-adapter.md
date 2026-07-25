# Kilo Code (local) Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-parity Paperclip agent adapter (`kilocode_local`) that runs the Kilo Code CLI (`kilo`, npm `@kilocode/cli`) locally, cloned from `opencode_local`.

**Architecture:** New `@paperclipai/adapter-kilocode-local` package (four exports: `.`/`./server`/`./ui`/`./cli`), created by copying `packages/adapters/opencode-local` and re-flavoring for Kilo (command `kilo`, `kilo run --format json`, `kilo/<provider>/<model>` model namespace, dual `UnknownError`/`APIError` event shapes). Registered into the shared/server/cli/ui registries exactly where `opencode_local` is.

**Tech Stack:** TypeScript (ESM), pnpm workspaces, Vitest, `@paperclipai/adapter-utils`.

**Spec:** `docs/specs/kilocode-local-adapter.md`

## Global Constraints

- Type string is exactly `kilocode_local`; label is exactly `Kilo Code (local)`; package name `@paperclipai/adapter-kilocode-local`.
- Default runtime command is `kilo`; runtime install spec via `buildNpmRuntimeCommandSpec(config, "kilo", "@kilocode/cli")`.
- Model ids MUST be `kilo/<provider>/<model>` form (e.g. `kilo/anthropic/claude-haiku-4.5`); `kilo-auto/*` are virtual and invalid for `--model`.
- Cheap-lane override env vars: `PAPERCLIP_KILOCODE_CHEAP_MODEL`, `PAPERCLIP_KILOCODE_SMALL_MODEL`.
- Every `opencode_local` string/reference has a mirrored `kilocode_local` counterpart (full parity) — no adapter left half-registered.
- Package version starts at `0.0.1`. Follow existing file/module boundaries from `opencode-local` exactly.
- Run all commands from repo root `/home/vladimir/develop/paperclip`. Kilo hits a self-signed host in this env; export `NODE_TLS_REJECT_UNAUTHORIZED=0` for any live `kilo` smoke test only (never bake into adapter code).

---

### Task 0: Verify Kilo runtime facts with live data

**Files:** none (produces `docs/specs/kilocode-local-adapter.md` "verified" notes appended at end).

- [ ] **Step 1: Capture a successful `kilo run --format json` event stream** using an entitled model. First list entitled models, pick a cheap one that is not `PAID_MODEL_AUTH_REQUIRED`:

```bash
kilo models | head -60
# pick a free/entitled model id, then:
NODE_TLS_REJECT_UNAUTHORIZED=0 kilo run --format json --model <ENTITLED_MODEL> "Reply with exactly: pong" | tee /tmp/kilo-run.jsonl
```

Expected: JSONL lines whose `type` is one of `text`, `step_finish`, `tool_use`, `error` (same as OpenCode). Record any `type` value NOT in that set.

- [ ] **Step 2: Confirm the `step_finish` token/cost shape** matches `parseOpenCodeJsonl` (`part.tokens.{input,output,reasoning}`, `part.tokens.cache.read`, `part.cost`):

```bash
grep '"step_finish"' /tmp/kilo-run.jsonl | python3 -m json.tool | head -40
```

- [ ] **Step 3: Confirm `kilo models` output format** (one id per line, `kilo/...`):

```bash
kilo models | head; kilo models | grep -c '^kilo/'
```

- [ ] **Step 4: Determine permission/project-config controls.** Confirm these flags exist and note the Kilo equivalent of `OPENCODE_DISABLE_PROJECT_CONFIG`:

```bash
kilo run --help | grep -iE 'auto|permission|dangerous|config|print-logs'
```

Expected: `--auto`, `--dangerously-skip-permissions`, `--print-logs` present.

- [ ] **Step 5: Record findings** by appending a short "Verified 2026-07-15" block to `docs/specs/kilocode-local-adapter.md` listing: the concrete entitled default + cheap model ids chosen, any extra `type` values, and the permission approach.

- [ ] **Step 6: Commit**

```bash
git add docs/specs/kilocode-local-adapter.md
git commit -m "docs(kilocode): record verified kilo run/models facts"
```

---

### Task 1: Scaffold the package by copying opencode-local

**Files:**
- Create: `packages/adapters/kilocode-local/` (copy of `packages/adapters/opencode-local/src`, `tsconfig.json`, `vitest.config.ts`)
- Create: `packages/adapters/kilocode-local/package.json`

**Interfaces:**
- Produces: package `@paperclipai/adapter-kilocode-local` resolvable by pnpm workspace; four subpath exports as in opencode-local.

- [ ] **Step 1: Copy source tree (exclude dist)**

```bash
cd packages/adapters
mkdir kilocode-local
cp -r opencode-local/src kilocode-local/src
cp opencode-local/tsconfig.json kilocode-local/tsconfig.json
cp opencode-local/vitest.config.ts kilocode-local/vitest.config.ts
```

- [ ] **Step 2: Write `packages/adapters/kilocode-local/package.json`** (copy of opencode-local's with name/version/directory changed):

```json
{
  "name": "@paperclipai/adapter-kilocode-local",
  "version": "0.0.1",
  "license": "MIT",
  "homepage": "https://github.com/paperclipai/paperclip",
  "bugs": { "url": "https://github.com/paperclipai/paperclip/issues" },
  "repository": { "type": "git", "url": "https://github.com/paperclipai/paperclip", "directory": "packages/adapters/kilocode-local" },
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./server": "./src/server/index.ts",
    "./ui": "./src/ui/index.ts",
    "./cli": "./src/cli/index.ts"
  },
  "publishConfig": {
    "access": "public",
    "exports": {
      ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
      "./server": { "types": "./dist/server/index.d.ts", "import": "./dist/server/index.js" },
      "./ui": { "types": "./dist/ui/index.d.ts", "import": "./dist/ui/index.js" },
      "./cli": { "types": "./dist/cli/index.d.ts", "import": "./dist/cli/index.js" }
    },
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts"
  },
  "files": ["dist", "skills"],
  "scripts": { "build": "tsc", "clean": "rm -rf dist", "typecheck": "tsc --noEmit" },
  "dependencies": { "@paperclipai/adapter-utils": "workspace:*", "picocolors": "^1.1.1" },
  "devDependencies": { "@types/node": "^24.6.0", "typescript": "^5.7.3" }
}
```

- [ ] **Step 3: If opencode-local ships a `skills/` dir, copy it** (skip if absent):

```bash
[ -d opencode-local/skills ] && cp -r opencode-local/skills kilocode-local/skills || echo "no skills dir"
```

- [ ] **Step 3b: Wire workspace consumers + root build/test configs** (GAP FIX — required or Tasks 10–13 fail to resolve/build/test):
  - Add `"@paperclipai/adapter-kilocode-local": "workspace:*"` to the `dependencies` of `server/package.json`, `ui/package.json`, and `cli/package.json` (beside the existing `@paperclipai/adapter-opencode-local` line).
  - Add `{ "path": "./packages/adapters/kilocode-local" }` to the root `tsconfig.json` `references` array (beside opencode-local).
  - Add `"packages/adapters/kilocode-local"` to the projects list in root `vitest.config.ts` (beside opencode-local).
  - Add a kilocode entry to `scripts/release-package-manifest.json` mirroring the opencode-local block (`dir`, `name`).

- [ ] **Step 4: Install workspace links**

```bash
cd ../.. && pnpm install
```

Expected: pnpm reports `+ @paperclipai/adapter-kilocode-local` linked, no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/kilocode-local pnpm-lock.yaml
git commit -m "feat(kilocode): scaffold adapter-kilocode-local package (copy of opencode-local)"
```

---

### Task 2: Re-flavor `src/index.ts` (identity, models, docs)

**Files:**
- Modify: `packages/adapters/kilocode-local/src/index.ts` (replace wholesale)
- Modify: `packages/adapters/kilocode-local/src/index.test.ts` (rename assertions)

**Interfaces:**
- Produces: `type = "kilocode_local"`, `label = "Kilo Code (local)"`, `models`, `DEFAULT_KILOCODE_LOCAL_MODEL`, `DEFAULT_KILOCODE_CHEAP_MODEL`, `buildKilocodeModelProfiles(env)`, `modelProfiles`, `isValidKilocodeModelId(v)`, `SANDBOX_INSTALL_COMMAND`, `agentConfigurationDoc`.

- [ ] **Step 1: Write the failing test** in `src/index.test.ts` (replace opencode assertions):

```ts
import { describe, it, expect } from "vitest";
import { type, label, isValidKilocodeModelId, DEFAULT_KILOCODE_LOCAL_MODEL, modelProfiles } from "./index.js";

describe("kilocode-local index", () => {
  it("has the right identity", () => {
    expect(type).toBe("kilocode_local");
    expect(label).toBe("Kilo Code (local)");
  });
  it("validates kilo/<provider>/<model> ids and rejects kilo-auto and openai", () => {
    expect(isValidKilocodeModelId("kilo/anthropic/claude-haiku-4.5")).toBe(true);
    expect(isValidKilocodeModelId("kilo-auto/small")).toBe(false);
    expect(isValidKilocodeModelId("openai/gpt-5.2")).toBe(false);
    expect(isValidKilocodeModelId("")).toBe(false);
  });
  it("default model is a kilo/ id and cheap profile exists", () => {
    expect(DEFAULT_KILOCODE_LOCAL_MODEL.startsWith("kilo/")).toBe(true);
    expect(modelProfiles.find((p) => p.key === "cheap")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @paperclipai/adapter-kilocode-local exec vitest run src/index.test.ts`
Expected: FAIL (`isValidKilocodeModelId` not exported; `type` still `opencode_local`).

- [ ] **Step 3: Replace `src/index.ts`** with (use the concrete model ids chosen in Task 0; the ids below are the plan defaults — swap for entitled ones if Task 0 found otherwise):

```ts
import type { AdapterModelProfileDefinition } from "@paperclipai/adapter-utils";

export const type = "kilocode_local";
export const label = "Kilo Code (local)";

// Kilo ships as a normal npm global; no curl|bash installer needed (unlike OpenCode).
export const SANDBOX_INSTALL_COMMAND = "npm install -g @kilocode/cli";

export const DEFAULT_KILOCODE_LOCAL_MODEL = "kilo/anthropic/claude-sonnet-4.5";

// kilo/<provider>/<model>; also allows alias form kilo/~openai/gpt-latest.
export function isValidKilocodeModelId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith("kilo/")) return false;
  const rest = trimmed.slice("kilo/".length).replace(/^~/, "");
  const slash = rest.indexOf("/");
  return slash > 0 && slash !== rest.length - 1;
}

export const models: Array<{ id: string; label: string }> = [
  { id: DEFAULT_KILOCODE_LOCAL_MODEL, label: DEFAULT_KILOCODE_LOCAL_MODEL },
  { id: "kilo/anthropic/claude-opus-4.8", label: "kilo/anthropic/claude-opus-4.8" },
  { id: "kilo/anthropic/claude-haiku-4.5", label: "kilo/anthropic/claude-haiku-4.5" },
  { id: "kilo/~openai/gpt-latest", label: "kilo/~openai/gpt-latest" },
  { id: "kilo/~google/gemini-flash-latest", label: "kilo/~google/gemini-flash-latest" },
];

export const DEFAULT_KILOCODE_CHEAP_MODEL = "kilo/anthropic/claude-haiku-4.5";

export function buildKilocodeModelProfiles(
  env: NodeJS.ProcessEnv = typeof process === "undefined" ? {} : process.env,
): AdapterModelProfileDefinition[] {
  const override = (env.PAPERCLIP_KILOCODE_CHEAP_MODEL ?? env.PAPERCLIP_KILOCODE_SMALL_MODEL)?.trim();
  return [
    {
      key: "cheap",
      label: "Cheap",
      description: "Budget lane model for recovery retries and other low-cost tasks.",
      adapterConfig: { model: override || DEFAULT_KILOCODE_CHEAP_MODEL },
      source: "adapter_default",
    },
  ];
}

export const modelProfiles: AdapterModelProfileDefinition[] = buildKilocodeModelProfiles();

export const agentConfigurationDoc = `# kilocode_local agent configuration

Adapter: kilocode_local

Use when:
- You want Paperclip to run the Kilo Code CLI locally as the agent runtime
- You want provider/model routing in Kilo format (kilo/provider/model)
- You want Kilo session resume across heartbeats via --session

Don't use when:
- The Kilo CLI (@kilocode/cli) is not installed on the machine
- You are not signed in and only need paid models (run \`kilo auth\`)

Core fields:
- cwd (string, optional): default working directory fallback
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to the run prompt
- model (string, required): Kilo model id in kilo/provider/model format (for example kilo/anthropic/claude-sonnet-4.5)
- variant (string, optional): provider-specific reasoning variant passed as --variant
- command (string, optional): defaults to "kilo"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Runs are executed with: kilo run --format json ...
- Sessions are resumed with --session when stored session cwd matches current cwd.
- Use \`kilo models\` to list available options; ids are kilo/provider/model.
- Kilo keeps a git-style snapshot repo under ~/.local/share/kilo/snapshot; that dir must be writable by the runtime user or runs fail with an opaque "Unexpected server error".
`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @paperclipai/adapter-kilocode-local exec vitest run src/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/kilocode-local/src/index.ts packages/adapters/kilocode-local/src/index.test.ts
git commit -m "feat(kilocode): adapter identity, kilo model namespace, model profiles"
```

---

### Task 3: Port `server/parse.ts` + handle APIError shape

**Files:**
- Modify: `packages/adapters/kilocode-local/src/server/parse.ts`
- Modify: `packages/adapters/kilocode-local/src/server/parse.test.ts`

**Interfaces:**
- Produces: `parseKiloJsonl(stdout)` → `{ sessionId, summary, usage:{inputTokens,cachedInputTokens,outputTokens}, costUsd, errorMessage, toolErrors }`; `isKiloUnknownSessionError(stdout, stderr)`.
- Consumed by: `server/execute.ts` (Task 5), `server/index.ts` (Task 6).

- [ ] **Step 1: Write the failing test** `src/server/parse.test.ts` (add APIError coverage on top of ported opencode cases):

```ts
import { describe, it, expect } from "vitest";
import { parseKiloJsonl, isKiloUnknownSessionError } from "./parse.js";

describe("parseKiloJsonl", () => {
  it("aggregates text, tokens/cost, and captures UnknownError", () => {
    const stdout = [
      JSON.stringify({ type: "text", sessionID: "ses_1", part: { text: "hello" } }),
      JSON.stringify({ type: "step_finish", part: { tokens: { input: 10, output: 5, reasoning: 2, cache: { read: 3 } }, cost: 0.01 } }),
      JSON.stringify({ type: "error", sessionID: "ses_1", error: { name: "UnknownError", data: { message: "Unexpected server error", ref: "err_1" } } }),
    ].join("\n");
    const r = parseKiloJsonl(stdout);
    expect(r.sessionId).toBe("ses_1");
    expect(r.summary).toBe("hello");
    expect(r.usage).toEqual({ inputTokens: 10, cachedInputTokens: 3, outputTokens: 7 });
    expect(r.costUsd).toBeCloseTo(0.01);
    expect(r.errorMessage).toContain("Unexpected server error");
  });

  it("extracts APIError message with statusCode", () => {
    const stdout = JSON.stringify({
      type: "error",
      error: { name: "APIError", data: { message: "Unauthorized: paid_model_auth_required", statusCode: 401 } },
    });
    const r = parseKiloJsonl(stdout);
    expect(r.errorMessage).toContain("Unauthorized");
  });

  it("detects unknown-session errors", () => {
    expect(isKiloUnknownSessionError('{"error":"unknown session"}', "")).toBe(true);
    expect(isKiloUnknownSessionError("all good", "")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @paperclipai/adapter-kilocode-local exec vitest run src/server/parse.test.ts`
Expected: FAIL (`parseKiloJsonl` not exported).

- [ ] **Step 3: Edit `src/server/parse.ts`**: rename `parseOpenCodeJsonl`→`parseKiloJsonl`, `isOpenCodeUnknownSessionError`→`isKiloUnknownSessionError`. The existing `errorText()` already reads `error.data.message` then `error.name`, which covers both `UnknownError` and `APIError` (APIError's `data.message` carries the text). No other logic changes — the event `type` set (`text`/`step_finish`/`tool_use`/`error`) is identical (confirmed in Task 0). Keep the token/cost aggregation as-is.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @paperclipai/adapter-kilocode-local exec vitest run src/server/parse.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/kilocode-local/src/server/parse.ts packages/adapters/kilocode-local/src/server/parse.test.ts
git commit -m "feat(kilocode): port JSONL parser, handle UnknownError + APIError"
```

---

### Task 4: Port `server/models.ts` (kilo model validation + availability probe)

**Files:**
- Modify: `packages/adapters/kilocode-local/src/server/models.ts`
- Modify: `packages/adapters/kilocode-local/src/server/models.test.ts`

**Interfaces:**
- Produces: `requireKiloModelId(v)`, `parseKiloModelsOutput(stdout)`, `ensureKiloModelConfiguredAndAvailable({model,command,cwd,env})`, `isTruthyEnvFlag(v)`, `listKiloModels`, `discoverKiloModels`, `resetKiloModelsCacheForTests`.
- Consumes: `isValidKilocodeModelId` from `../index.js`.

- [ ] **Step 1: Read the source** `packages/adapters/opencode-local/src/server/models.ts` in full to see exact exports and cache logic.

- [ ] **Step 2: Write the failing test** `src/server/models.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseKiloModelsOutput, requireKiloModelId } from "./models.js";

describe("kilo models", () => {
  it("parses `kilo models` lines into ids", () => {
    const out = "kilo/anthropic/claude-haiku-4.5\nkilo/~openai/gpt-latest\n";
    expect(parseKiloModelsOutput(out).map((m) => m.id)).toEqual([
      "kilo/anthropic/claude-haiku-4.5",
      "kilo/~openai/gpt-latest",
    ]);
  });
  it("requireKiloModelId rejects non-kilo ids", () => {
    expect(() => requireKiloModelId("openai/gpt-5.2")).toThrow();
    expect(requireKiloModelId("kilo/anthropic/claude-haiku-4.5")).toBe("kilo/anthropic/claude-haiku-4.5");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @paperclipai/adapter-kilocode-local exec vitest run src/server/models.test.ts`
Expected: FAIL.

- [ ] **Step 4: Rewrite `src/server/models.ts`** by porting opencode's file: rename all `OpenCode`→`Kilo` in identifiers; change the probe command from `opencode models` to `kilo models`; replace the model-id validity check to use `isValidKilocodeModelId` (import from `../index.js`); change env flag names `OPENCODE_ALLOW_ALL_MODELS`→`KILOCODE_ALLOW_ALL_MODELS`. `parseKiloModelsOutput` splits stdout by lines, trims, keeps lines matching `/^kilo\//` (confirmed one-id-per-line in Task 0).

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @paperclipai/adapter-kilocode-local exec vitest run src/server/models.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/adapters/kilocode-local/src/server/models.ts packages/adapters/kilocode-local/src/server/models.test.ts
git commit -m "feat(kilocode): port model listing/validation for kilo/ namespace"
```

---

### Task 5: Port `server/execute.ts`

**Files:**
- Modify: `packages/adapters/kilocode-local/src/server/execute.ts`
- Modify: `packages/adapters/kilocode-local/src/server/execute.test.ts`
- Modify: `packages/adapters/kilocode-local/src/server/execute.remote.test.ts`

**Interfaces:**
- Produces: `execute(ctx): Promise<AdapterExecutionResult>` and `ensureRemoteKiloModelConfiguredAndAvailable(...)`.
- Consumes: `parseKiloJsonl`/`isKiloUnknownSessionError` (Task 3), model helpers (Task 4), `SANDBOX_INSTALL_COMMAND` (Task 2).

- [ ] **Step 1: Apply mechanical renames** in `execute.ts`:
  - `command = asString(config.command, "opencode")` → `"kilo"`.
  - Import `parseOpenCodeJsonl`/`isOpenCodeUnknownSessionError` → `parseKiloJsonl`/`isKiloUnknownSessionError`.
  - Import model helpers from Task 4 (`ensureKiloModelConfiguredAndAvailable`, `requireKiloModelId`, `parseKiloModelsOutput`, `isTruthyEnvFlag`).
  - `onMeta({ adapterType: "opencode_local", ... })` → `"kilocode_local"`.
  - Env flags: `OPENCODE_ALLOW_ALL_MODELS`→`KILOCODE_ALLOW_ALL_MODELS`; `PAPERCLIP_OPENCODE_PRINT_LOGS`→`PAPERCLIP_KILOCODE_PRINT_LOGS`; `OPENCODE_DISABLE_PROJECT_CONFIG` handling moves to Task 6's runtime-config (keep the env write here only if Task 0 confirmed a Kilo equivalent; otherwise remove that line).
  - Remote probe helper `ensureRemoteOpenCodeModelConfiguredAndAvailable`→`ensureRemoteKiloModelConfiguredAndAvailable`; `adapterKey: "opencode"`→`"kilo"`; error strings `opencode models`→`kilo models`.
  - `buildArgs` stays: `["run","--format","json", (printLogs?"--print-logs"), (--session), (--model), (--variant), ...extraArgs]`.

- [ ] **Step 2: Update `execute.test.ts` and `execute.remote.test.ts`**: rename imported symbols, expected `adapterType`, default command `kilo`, and any `opencode`-literal fixtures. Keep the test *structure* identical.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @paperclipai/adapter-kilocode-local exec vitest run src/server/execute.test.ts src/server/execute.remote.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/adapters/kilocode-local/src/server/execute.ts packages/adapters/kilocode-local/src/server/execute.test.ts packages/adapters/kilocode-local/src/server/execute.remote.test.ts
git commit -m "feat(kilocode): port execute() to run kilo run --format json"
```

---

### Task 6: Port `runtime-config.ts`, `skills.ts`, `test.ts` (testEnvironment), `server/index.ts`

**Files:**
- Modify: `packages/adapters/kilocode-local/src/server/runtime-config.ts` (+ its test)
- Modify: `packages/adapters/kilocode-local/src/server/skills.ts`
- Modify: `packages/adapters/kilocode-local/src/server/test.ts` (+ `test.remote.test.ts`)
- Modify: `packages/adapters/kilocode-local/src/server/index.ts`

**Interfaces:**
- Produces: `prepareKiloRuntimeConfig({env,config})`, `testEnvironment(ctx)`, and re-exports from `server/index.ts`: `execute`, `testEnvironment`, `sessionCodec`, `parseKiloJsonl`, `isKiloUnknownSessionError`, `listKiloModels`, `discoverKiloModels`, `ensureKiloModelConfiguredAndAvailable`, `requireKiloModelId`, `resetKiloModelsCacheForTests`, `listKiloSkills`, `syncKiloSkills`.

- [ ] **Step 1: Port `runtime-config.ts`** renaming `prepareOpenCodeRuntimeConfig`→`prepareKiloRuntimeConfig`. If Task 0 found a Kilo project-config file to suppress (analog of `opencode.json`), keep the temp-XDG_CONFIG_HOME injection targeting `~/.config/kilo`; otherwise reduce to a no-op that still returns `{env, notes, cleanup}` with the same shape. Update its test accordingly.

- [ ] **Step 2: Port `skills.ts`** renaming `listOpenCodeSkills`/`syncOpenCodeSkills`→`listKiloSkills`/`syncKiloSkills` (logic unchanged — still injects into `~/.claude/skills`).

- [ ] **Step 3: Write the failing test** for the new data-dir writability check in `src/server/test.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { testEnvironment } from "./test.js";

describe("kilocode testEnvironment", () => {
  it("returns a structured result with adapterType kilocode_local", async () => {
    const res = await testEnvironment({ companyId: "c1", adapterType: "kilocode_local", config: {} } as any);
    expect(res.adapterType).toBe("kilocode_local");
    expect(["pass", "warn", "fail"]).toContain(res.status);
    expect(Array.isArray(res.checks)).toBe(true);
  });
});
```

- [ ] **Step 4: Port `test.ts`**: rename identifiers; command `kilo`; add a check with `code: "kilo_data_dir_writable"` that resolves `~/.local/share/kilo` (respecting `XDG_DATA_HOME`) and attempts a temp write, returning `error` on `EACCES` with hint "Fix ownership: chown -R <user> ~/.local/share/kilo" (this encodes the snapshot-permission lesson). Auth-not-signed-in → `warn`, not `error`.

- [ ] **Step 5: Update `server/index.ts`** exports to the renamed symbols (list in Interfaces above).

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @paperclipai/adapter-kilocode-local exec vitest run src/server`
Expected: PASS (all server tests).

- [ ] **Step 7: Commit**

```bash
git add packages/adapters/kilocode-local/src/server
git commit -m "feat(kilocode): port runtime-config, skills, testEnvironment (data-dir writability check)"
```

---

### Task 7: Port UI surface (package + ui/src adapter + logo)

**Files:**
- Modify: `packages/adapters/kilocode-local/src/ui/{parse-stdout.ts,build-config.ts,index.ts}`
- Create: `ui/src/adapters/kilocode-local/index.ts`, `ui/src/adapters/kilocode-local/config-fields.tsx`
- Create: `ui/src/components/KiloCodeLogoIcon.tsx`

**Interfaces:**
- Produces (package `./ui`): `parseStdoutLine`, `buildAdapterConfig`, `type`, `label`.
- Produces (`ui/src/adapters/kilocode-local`): `kilocodeLocalUIAdapter` matching `UIAdapterModule`.

- [ ] **Step 1: Port the package `src/ui/*`** — rename opencode identifiers; `parse-stdout.ts` reuses the same `type` set as `parse.ts`. Update `src/ui/index.ts` `type`/`label` to `kilocode_local`/`Kilo Code (local)`.

- [ ] **Step 2: Read** `ui/src/adapters/opencode-local/index.ts` and `config-fields.tsx` and `ui/src/components/OpenCodeLogoIcon.tsx`.

- [ ] **Step 3: Create `ui/src/adapters/kilocode-local/config-fields.tsx`** as a copy of opencode's, with model placeholder text `kilo/anthropic/claude-sonnet-4.5` and label `Kilo Code (local)`.

- [ ] **Step 4: Create `ui/src/adapters/kilocode-local/index.ts`** exporting `kilocodeLocalUIAdapter` (copy opencode's `openCodeLocalUIAdapter`, swap `type`, `label`, `ConfigFields`, `parseStdoutLine`, `buildAdapterConfig` from `@paperclipai/adapter-kilocode-local/ui`, and the logo).

- [ ] **Step 5: Create `ui/src/components/KiloCodeLogoIcon.tsx`** (copy OpenCodeLogoIcon; replace SVG path with a simple Kilo glyph or a neutral placeholder `K` mark — keep the same props/signature).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @paperclipai/paperclip-ui exec tsc --noEmit` (or the repo's UI typecheck script)
Expected: no new errors referencing kilocode files.

- [ ] **Step 7: Commit**

```bash
git add packages/adapters/kilocode-local/src/ui ui/src/adapters/kilocode-local ui/src/components/KiloCodeLogoIcon.tsx
git commit -m "feat(kilocode): UI adapter, config fields, logo"
```

---

### Task 8: Port CLI surface

**Files:**
- Modify: `packages/adapters/kilocode-local/src/cli/{format-event.ts,index.ts}`

**Interfaces:**
- Produces: `printKiloStreamEvent(line, debug)`.

- [ ] **Step 1: Rename** `printOpenCodeStreamEvent`→`printKiloStreamEvent` in `format-event.ts`; update `cli/index.ts` `type` to `kilocode_local` and export `printKiloStreamEvent`. Logic (colored event formatting) unchanged — same event `type` set.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @paperclipai/adapter-kilocode-local exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/adapters/kilocode-local/src/cli
git commit -m "feat(kilocode): CLI stdout event formatter"
```

---

### Task 9: Register in shared

**Files:**
- Modify: `packages/shared/src/constants.ts` (near line 30–43, `AGENT_ADAPTER_TYPES`)
- Modify: `packages/shared/src/environment-support.ts` (near line 39)

- [ ] **Step 1: Add `"kilocode_local"`** to the `AGENT_ADAPTER_TYPES` array (place it adjacent to `"opencode_local"`).

- [ ] **Step 2: Add `"kilocode_local"`** to the supported list in `environment-support.ts` alongside `"opencode_local"`.

- [ ] **Step 2b: Register session management** (GAP FIX — else `--session` resume is silently disabled) in `packages/adapter-utils/src/session-compaction.ts`:
  - Add `"kilocode_local"` to the `LEGACY_SESSIONED_ADAPTER_TYPES` set.
  - Add a `kilocode_local` entry to `ADAPTER_SESSION_MANAGEMENT` mirroring `opencode_local` (`supportsSessionResume: true`, `nativeContextManagement: "unknown"`, `defaultSessionCompaction: DEFAULT_SESSION_COMPACTION_POLICY`).

- [ ] **Step 3: Typecheck shared**

Run: `pnpm --filter @paperclipai/shared exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/environment-support.ts
git commit -m "feat(kilocode): register kilocode_local in shared adapter types"
```

---

### Task 10: Register in server (registry + builtin types + service audit)

**Files:**
- Modify: `server/src/adapters/registry.ts` (imports ~line 101/106; registration ~line 399–413)
- Modify: `server/src/adapters/builtin-adapter-types.ts`
- Modify (audit): `server/src/routes/agents.ts`, `server/src/services/{heartbeat.ts,recovery/service.ts,company-portability.ts,environment-execution-target.ts,feedback.ts}`

- [ ] **Step 1: Add imports** mirroring the opencode block, from `@paperclipai/adapter-kilocode-local/server` and `@paperclipai/adapter-kilocode-local`.

- [ ] **Step 2: Register the server adapter object** mirroring the opencode entry (~line 399), with:
  - `type: "kilocode_local"`
  - `sessionManagement: getAdapterSessionManagement("kilocode_local") ?? undefined`
  - `getRuntimeCommandSpec: (config) => buildNpmRuntimeCommandSpec(config, "kilo", "@kilocode/cli")`
  - execute/testEnvironment/sessionCodec/models/modelProfiles/agentConfigurationDoc from the imports.

- [ ] **Step 3: Add `"kilocode_local"`** to `builtin-adapter-types.ts`.

- [ ] **Step 4: Audit each service** — grep each file for `opencode_local`; for every occurrence decide whether Kilo needs identical treatment (session management, npm-command spec, portability mapping, recovery lane, feedback labels) and mirror it. Add `kilocode_local` beside `opencode_local` in each list/switch that is adapter-generic.

```bash
grep -rn 'opencode_local' server/src/routes/agents.ts server/src/services/heartbeat.ts server/src/services/recovery/service.ts server/src/services/company-portability.ts server/src/services/environment-execution-target.ts server/src/services/feedback.ts
```

- [ ] **Step 5: Typecheck + server adapter registry test**

Run: `pnpm --filter @paperclipai/server exec tsc --noEmit && pnpm --filter @paperclipai/server exec vitest run src/__tests__/adapter-registry.test.ts`
Expected: PASS; registry lists `kilocode_local`.

- [ ] **Step 6: Commit**

```bash
git add server/src
git commit -m "feat(kilocode): register kilocode_local server adapter + service parity"
```

---

### Task 11: Register in CLI

**Files:**
- Modify: `cli/src/adapters/registry.ts` (import ~line 9; registration ~line 31)

- [ ] **Step 1: Import** `printKiloStreamEvent` from `@paperclipai/adapter-kilocode-local/cli` and register a `{ type: "kilocode_local", formatStdoutEvent }` entry mirroring opencode.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @paperclipai/cli exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add cli/src/adapters/registry.ts
git commit -m "feat(kilocode): register kilocode_local CLI formatter"
```

---

### Task 12: Register in UI (registry + display + capabilities + hardcoded lists)

**Files:**
- Modify: `ui/src/adapters/registry.ts` (import ~line 9)
- Modify: `ui/src/adapters/adapter-display-registry.ts`
- Modify: `ui/src/adapters/use-adapter-capabilities.ts`
- Modify: `ui/src/components/{AgentConfigForm.tsx,IssueProperties.tsx,NewIssueDialog.tsx,OnboardingWizard.tsx,OnboardingWizardClassic.tsx,agent-config-primitives.tsx}`
- Modify: `ui/src/pages/{InviteLanding.tsx,NewAgent.tsx}`
- Modify: `ui/src/lib/issue-assignee-overrides.ts`

- [ ] **Step 1: Import + register** `kilocodeLocalUIAdapter` in `ui/src/adapters/registry.ts` (mirror `openCodeLocalUIAdapter`).

- [ ] **Step 2: Add display metadata** in `adapter-display-registry.ts` (label `Kilo Code (local)`, `KiloCodeLogoIcon`, colors mirroring opencode).

- [ ] **Step 3: Add capabilities entry** in `use-adapter-capabilities.ts` mirroring opencode's.

- [ ] **Step 4: For each remaining file**, grep for `opencode_local`/`opencode-local`/`OpenCode` and add the parallel `kilocode_local` entry wherever the list is adapter-generic (option lists, labels, icon maps, assignee overrides):

```bash
grep -rn 'opencode_local\|opencode-local\|OpenCode' ui/src/components/AgentConfigForm.tsx ui/src/components/IssueProperties.tsx ui/src/components/NewIssueDialog.tsx ui/src/components/OnboardingWizard.tsx ui/src/components/OnboardingWizardClassic.tsx ui/src/components/agent-config-primitives.tsx ui/src/pages/InviteLanding.tsx ui/src/pages/NewAgent.tsx ui/src/lib/issue-assignee-overrides.ts
```

- [ ] **Step 5: Typecheck + UI registry test**

Run: `pnpm --filter @paperclipai/paperclip-ui exec tsc --noEmit && pnpm --filter @paperclipai/paperclip-ui exec vitest run src/adapters/registry.test.ts`
Expected: PASS; `findUIAdapter("kilocode_local")` resolves.

- [ ] **Step 6: Commit**

```bash
git add ui/src
git commit -m "feat(kilocode): register kilocode_local across UI registry, display, and adapter lists"
```

---

### Task 13: Full build, test, and live smoke

**Files:** none (verification).

- [ ] **Step 1: Workspace typecheck + build**

Run: `pnpm -r typecheck && pnpm -r build`
Expected: no errors.

- [ ] **Step 2: Full test suite for touched packages**

Run: `pnpm --filter @paperclipai/adapter-kilocode-local exec vitest run && pnpm --filter @paperclipai/server exec vitest run && pnpm --filter @paperclipai/shared exec vitest run && pnpm --filter @paperclipai/paperclip-ui exec vitest run`
Expected: PASS.

- [ ] **Step 3: Live smoke** — create a `kilocode_local` agent via the running dev server (or CLI) with model `kilo/anthropic/claude-haiku-4.5` and run a trivial task; confirm a transcript renders and the run succeeds. If it fails with "Unexpected server error", run `testEnvironment` — the new data-dir-writable check should point at `~/.local/share/kilo` ownership.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "test(kilocode): full build/test/smoke pass for kilocode_local adapter"
```

---

## Self-Review

- **Spec coverage:** identity/package (T1–2), OpenCode-fork clone (T1), model namespace + cheap profile (T2), dual error shapes (T3), models probe (T4), execute/session-resume + remote parity (T5), runtime-config/skills/testEnvironment + snapshot-permission check (T6), UI (T7,T12), CLI (T8,T11), shared (T9), server registry + service audit (T10), risks resolved in T0. All spec sections mapped.
- **Placeholder scan:** model ids are concrete defaults with a Task-0 override note (not TBD); each porting task shows the exact renames/edits and the reference file to read. Service/UI "audit" tasks give the exact grep and the rule (mirror adapter-generic entries).
- **Type consistency:** `parseKiloJsonl`/`isKiloUnknownSessionError`, `requireKiloModelId`/`parseKiloModelsOutput`, `prepareKiloRuntimeConfig`, `kilocodeLocalUIAdapter`, `printKiloStreamEvent`, `isValidKilocodeModelId`, `buildNpmRuntimeCommandSpec(config,"kilo","@kilocode/cli")` used consistently across producing and consuming tasks.
