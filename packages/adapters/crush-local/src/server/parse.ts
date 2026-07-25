import { asNumber, asString, parseJson, parseObject } from "@paperclipai/adapter-utils/server-utils";

export function parseCrushRunSummary(stdout: string): string {
  return stdout.trim();
}

function readSessionId(rec: Record<string, unknown>): string | null {
  const id =
    asString(rec.id, "").trim() ||
    asString(rec.sessionId, "").trim() ||
    asString(rec.session_id, "").trim();
  return id || null;
}

function readSortKey(rec: Record<string, unknown>): number {
  const raw =
    asString(rec.updatedAt, "").trim() ||
    asString(rec.updated_at, "").trim() ||
    asString(rec.createdAt, "").trim() ||
    asString(rec.created_at, "").trim();
  const ms = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(ms) ? ms : -1;
}

function readUsage(rec: Record<string, unknown>) {
  const usage = parseObject(rec.usage ?? rec.tokens);
  return {
    inputTokens: asNumber(usage.inputTokens ?? usage.input ?? usage.promptTokens, 0),
    outputTokens: asNumber(usage.outputTokens ?? usage.output ?? usage.completionTokens, 0),
    cachedInputTokens: asNumber(
      usage.cachedInputTokens ?? usage.cacheReadTokens ?? usage.cached ?? 0,
      0,
    ),
  };
}

export function parseCrushSessionList(stdout: string): {
  sessionId: string | null;
  usage: { inputTokens: number; outputTokens: number; cachedInputTokens: number };
  costUsd: number;
} {
  const empty = {
    sessionId: null,
    usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
    costUsd: 0,
  };
  const parsed = parseJson(stdout.trim());
  if (!Array.isArray(parsed) || parsed.length === 0) return empty;

  const records = parsed
    .map((entry) => parseObject(entry))
    .filter((rec) => Object.keys(rec).length > 0);
  if (records.length === 0) return empty;

  let bestIndex = 0;
  let bestKey = readSortKey(records[0]);
  for (let i = 1; i < records.length; i += 1) {
    const key = readSortKey(records[i]);
    // Prefer the newest timestamp; when none are parseable, later array
    // entries win (Crush appends new sessions).
    if (key >= bestKey) {
      bestKey = key;
      bestIndex = i;
    }
  }

  const chosen = records[bestIndex];
  return {
    sessionId: readSessionId(chosen),
    usage: readUsage(chosen),
    costUsd: asNumber(chosen.cost ?? chosen.costUsd ?? chosen.totalCost, 0),
  };
}

export function isCrushUnknownSessionError(stdout: string, stderr: string): boolean {
  const haystack = `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
  return /unknown\s+session|session\b.*\bnot\s+found|no\s+sessions?\s+found|resource\s+not\s+found/i.test(
    haystack,
  );
}
