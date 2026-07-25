import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AdapterSkillContext,
  AdapterSkillSnapshot,
} from "@paperclipai/adapter-utils";
import {
  buildPersistentSkillSnapshot,
  ensurePaperclipSkillSymlink,
  readPaperclipRuntimeSkillEntries,
  readInstalledSkillTargets,
  resolvePaperclipDesiredSkillNames,
} from "@paperclipai/adapter-utils/server-utils";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveMimoSkillsHome(config: Record<string, unknown>) {
  const env =
    typeof config.env === "object" && config.env !== null && !Array.isArray(config.env)
      ? (config.env as Record<string, unknown>)
      : {};
  const configuredHome = asString(env.HOME);
  const home = configuredHome ? path.resolve(configuredHome) : os.homedir();
  return path.join(home, ".claude", "skills");
}

async function buildMimoSkillSnapshot(config: Record<string, unknown>): Promise<AdapterSkillSnapshot> {
  const availableEntries = await readPaperclipRuntimeSkillEntries(config, __moduleDir);
  const desiredSkills = resolvePaperclipDesiredSkillNames(config, availableEntries);
  const skillsHome = resolveMimoSkillsHome(config);
  const installed = await readInstalledSkillTargets(skillsHome);
  return buildPersistentSkillSnapshot({
    adapterType: "mimo_local",
    availableEntries,
    desiredSkills,
    installed,
    skillsHome,
    locationLabel: "~/.claude/skills",
    installedDetail: "Installed in the shared Claude/Mimo skills home.",
    missingDetail: "Configured but not currently linked into the shared Claude/Mimo skills home.",
    externalConflictDetail: "Skill name is occupied by an external installation in the shared skills home.",
    externalDetail: "Installed outside Paperclip management in the shared skills home.",
    warnings: [
      "Mimo currently uses the shared Claude skills home (~/.claude/skills).",
    ],
  });
}

export async function listMimoSkills(ctx: AdapterSkillContext): Promise<AdapterSkillSnapshot> {
  return buildMimoSkillSnapshot(ctx.config);
}

export async function syncMimoSkills(
  ctx: AdapterSkillContext,
  desiredSkills: string[],
): Promise<AdapterSkillSnapshot> {
  const availableEntries = await readPaperclipRuntimeSkillEntries(ctx.config, __moduleDir);
  const desiredSet = new Set(desiredSkills);
  const skillsHome = resolveMimoSkillsHome(ctx.config);
  await fs.mkdir(skillsHome, { recursive: true });
  const installed = await readInstalledSkillTargets(skillsHome);
  const availableByRuntimeName = new Map(availableEntries.map((entry) => [entry.runtimeName, entry]));

  for (const available of availableEntries) {
    if (!desiredSet.has(available.key)) continue;
    const target = path.join(skillsHome, available.runtimeName);
    await ensurePaperclipSkillSymlink(available.source, target);
  }

  for (const [name, installedEntry] of installed.entries()) {
    const available = availableByRuntimeName.get(name);
    if (!available) continue;
    if (desiredSet.has(available.key)) continue;
    if (installedEntry.targetPath !== available.source) continue;
    await fs.unlink(path.join(skillsHome, name)).catch(() => {});
  }

  return buildMimoSkillSnapshot(ctx.config);
}

export function resolveMimoDesiredSkillNames(
  config: Record<string, unknown>,
  availableEntries: Array<{ key: string }>,
) {
  return resolvePaperclipDesiredSkillNames(config, availableEntries);
}
