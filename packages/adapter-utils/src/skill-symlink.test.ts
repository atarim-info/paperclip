import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPersistentSkillSnapshot, ensurePaperclipSkillSymlink, readInstalledSkillTargets } from "./server-utils.js";

const skillId = "11111111-1111-4111-8111-111111111111";
const oldVersion = "22222222-2222-4222-8222-222222222222";
const newVersion = "33333333-3333-4333-8333-333333333333";

async function fixture(run: (root: string, oldSource: string, source: string, target: string) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-skill-refresh-"));
  const skillRoot = path.join(root, "skills", "company-a", "__versions__", skillId);
  const oldSource = path.join(skillRoot, oldVersion);
  const source = path.join(skillRoot, newVersion);
  const target = path.join(root, "installed", "cluster-skill");
  try {
    await fs.mkdir(oldSource, { recursive: true });
    await fs.mkdir(source, { recursive: true });
    await fs.mkdir(path.dirname(target));
    await fs.writeFile(path.join(oldSource, "SKILL.md"), "old instructions");
    await fs.writeFile(path.join(source, "SKILL.md"), "new instructions");
    await run(root, oldSource, source, target);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

describe("managed skill version symlink refresh", () => {
  it("refreshes a live previous version and the persistent snapshot", async () => {
    await fixture(async (_root, oldSource, source, target) => {
      await fs.symlink(oldSource, target, "dir");
      const snapshot = async () => buildPersistentSkillSnapshot({
        adapterType: "opencode_local",
        availableEntries: [{ key: "company/a/cluster-skill", runtimeName: "cluster-skill", source }],
        desiredSkills: ["company/a/cluster-skill"],
        installed: await readInstalledSkillTargets(path.dirname(target)),
        skillsHome: path.dirname(target),
        missingDetail: "Missing", externalConflictDetail: "External conflict", externalDetail: "External",
      });
      expect((await snapshot()).entries[0]).toMatchObject({ managed: true, state: "stale" });
      expect(await ensurePaperclipSkillSymlink(source, target)).toBe("repaired");
      expect(await fs.readFile(path.join(target, "SKILL.md"), "utf8")).toBe("new instructions");
      expect(await fs.readlink(target)).toBe(source);
      expect((await snapshot()).entries[0]).toMatchObject({ managed: true, state: "installed" });
      expect(await ensurePaperclipSkillSymlink(source, target)).toBe("skipped");
      expect(await ensurePaperclipSkillSymlink(oldSource, target)).toBe("repaired");
      expect(await fs.readFile(path.join(target, "SKILL.md"), "utf8")).toBe("old instructions");
    });
  });

  it("rebinds an existing version even while its source directory still exists", async () => {
    await fixture(async (_root, oldSource, source, target) => {
      await fs.symlink(path.relative(path.dirname(target), oldSource), target, "dir");
      expect(await ensurePaperclipSkillSymlink(source, target)).toBe("repaired");
      expect(await fs.readFile(path.join(target, "SKILL.md"), "utf8")).toBe("new instructions");
    });
  });
  it("keeps the working version when the selected source is missing", async () => {
    await fixture(async (_root, oldSource, source, target) => {
      await fs.symlink(oldSource, target, "dir");
      await fs.rm(source, { recursive: true });
      expect(await ensurePaperclipSkillSymlink(source, target)).toBe("skipped");
      expect(await fs.readlink(target)).toBe(oldSource);
      expect(await fs.readFile(path.join(target, "SKILL.md"), "utf8")).toBe("old instructions");
    });
  });
  it.each(["external", "other-skill", "other-company", "unversioned"])("preserves a live %s symlink", async (kind) => {
    await fixture(async (root, _oldSource, source, target) => {
      const external = kind === "other-skill"
        ? path.join(path.dirname(path.dirname(source)), "44444444-4444-4444-8444-444444444444", oldVersion)
        : kind === "other-company"
          ? path.join(root, "skills", "company-b", "__versions__", skillId, oldVersion)
          : kind === "unversioned" ? path.join(path.dirname(source), "custom") : path.join(root, "external");
      await fs.mkdir(external, { recursive: true });
      await fs.symlink(external, target, "dir");
      expect(await ensurePaperclipSkillSymlink(source, target)).toBe("skipped");
      expect(await fs.readlink(target)).toBe(external);
    });
  });

  it("preserves a user directory and repairs dangling links", async () => {
    await fixture(async (root, _oldSource, source, target) => {
      await fs.mkdir(target);
      expect(await ensurePaperclipSkillSymlink(source, target)).toBe("skipped");
      await fs.rmdir(target);
      await fs.symlink(path.join(root, "removed"), target, "dir");
      expect(await ensurePaperclipSkillSymlink(source, target)).toBe("repaired");
      expect(await fs.readlink(target)).toBe(source);
    });
  });
});