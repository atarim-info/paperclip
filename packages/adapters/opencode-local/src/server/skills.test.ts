import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { listOpenCodeSkills, syncOpenCodeSkills } from "./skills.js";

it("syncs a changed managed version and a pinned version without replacing external skills", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-skill-refresh-"));
  const skillRoot = path.join(root, "managed", "__versions__", "11111111-1111-4111-8111-111111111111");
  const previous = path.join(skillRoot, "22222222-2222-4222-8222-222222222222");
  const current = path.join(skillRoot, "33333333-3333-4333-8333-333333333333");
  const skillsHome = path.join(root, ".claude", "skills");
  const key = "company/test/cluster-skill";
  const config = (source: string) => ({
    env: { HOME: root },
    paperclipRuntimeSkills: [{ key, runtimeName: "cluster-skill", source }],
    paperclipSkillSync: { desiredSkills: [key] },
  });
  const ctx = (source: string) => ({ agentId: "test-agent", companyId: "test", adapterType: "opencode_local", config: config(source) });
  try {
    await fs.mkdir(previous, { recursive: true });
    await fs.mkdir(current, { recursive: true });
    await fs.writeFile(path.join(previous, "SKILL.md"), "previous");
    await fs.writeFile(path.join(current, "SKILL.md"), "current");
    expect((await syncOpenCodeSkills(ctx(previous), [key])).entries[0]).toMatchObject({ state: "installed", managed: true });
    expect((await listOpenCodeSkills(ctx(current))).entries[0]).toMatchObject({ state: "stale", managed: true });
    expect((await syncOpenCodeSkills(ctx(current), [key])).entries[0]).toMatchObject({ state: "installed", managed: true });
    expect(await fs.readFile(path.join(skillsHome, "cluster-skill", "SKILL.md"), "utf8")).toBe("current");
    expect((await syncOpenCodeSkills(ctx(previous), [key])).entries[0]).toMatchObject({ state: "installed", managed: true });
    expect(await fs.readFile(path.join(skillsHome, "cluster-skill", "SKILL.md"), "utf8")).toBe("previous");
    const target = path.join(skillsHome, "cluster-skill");
    await fs.unlink(target);
    const external = path.join(root, "user-installed");
    await fs.mkdir(external);
    await fs.symlink(external, target, "dir");
    expect((await syncOpenCodeSkills(ctx(current), [key])).entries[0]).toMatchObject({ state: "external", managed: false });
    expect(await fs.readlink(target)).toBe(external);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});