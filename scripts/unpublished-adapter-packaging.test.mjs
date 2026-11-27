import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { prepareBundledPackage, stageUnpublishedAdapter } from "./prepare-bundled-package.mjs";

import { unpublishedAdapterDirs } from "./release-package-map.mjs";

const adapters = Object.entries(unpublishedAdapterDirs);

test("an offline consumer loads all unpublished bundled adapters", t => {
  const root = mkdtempSync(join(tmpdir(), "paperclip-private-adapter-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const sourceRoot = join(root, "source"), serverSource = join(sourceRoot, "server");
  const dest = join(root, "server"), consumer = join(root, "consumer");
  mkdirSync(join(serverSource, "dist"), { recursive: true });
  mkdirSync(consumer);
  writeFileSync(join(sourceRoot, "package.json"), "{}");
  const version = "1.2.3";
  const manifest = {
    name: "paperclip-private-server-fixture", version, main: "dist/index.js", files: ["dist"],
    dependencies: Object.fromEntries(adapters.map(([name]) => [name, version])),
    bundleDependencies: adapters.map(([name]) => name),
  };
  for (const [name, dir] of adapters) {
    const source = join(sourceRoot, dir);
    const hasSkills = dir.endsWith("/kilocode-local");
    const declaresSkills = hasSkills || dir.endsWith("/mimo-local");
    mkdirSync(join(source, "dist", "server"), { recursive: true });
    writeFileSync(join(source, "dist", "index.js"), `export default ${JSON.stringify(name)};`);
    writeFileSync(join(source, "dist", "server", "index.js"), 'export default "server";');
    writeFileSync(join(source, "package.json"), JSON.stringify({
      name, version: "0.1.0", type: "module", files: declaresSkills ? ["dist", "skills"] : ["dist"],
      exports: "./src/index.ts",
      publishConfig: { exports: { ".": "./dist/index.js", "./server": "./dist/server/index.js" } },
    }));
    if (hasSkills) {
      mkdirSync(join(source, "skills", "fixture"), { recursive: true });
      writeFileSync(join(source, "skills", "fixture", "SKILL.md"), "# Fixture");
    }
  }
  writeFileSync(join(serverSource, "package.json"), JSON.stringify(manifest));
  writeFileSync(join(serverSource, "dist", "index.js"), "module.exports = 42;");
  prepareBundledPackage(serverSource, dest, { sourceRoot });
  execFileSync("npm", ["pack", "--offline", "--silent", "--pack-destination", root], { cwd: dest });
  execFileSync("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", join(root, `${manifest.name}-${version}.tgz`)], { cwd: consumer });
  const installed = join(consumer, "node_modules", manifest.name);
  for (const [name, dir] of adapters) {
    const adapter = join(installed, "node_modules", name);
    const staged = JSON.parse(readFileSync(join(adapter, "package.json"), "utf8"));
    assert.equal(staged.version, version);
    const result = execFileSync(process.execPath, ["--input-type=module", "-e",
      `console.log((await import(${JSON.stringify(name)})).default, (await import(${JSON.stringify(name + "/server")})).default)`],
    { cwd: installed, encoding: "utf8" });
    assert.equal(result.trim(), `${name} server`);
    const skills = join(adapter, "skills", "fixture", "SKILL.md");
    if (dir.endsWith("/kilocode-local")) assert.equal(readFileSync(skills, "utf8"), "# Fixture");
    else assert.throws(() => readFileSync(skills, "utf8"), { code: "ENOENT" });
  }
});

for (const [name, dir] of adapters) {
  test(`${name} requires built files and matching runtime dependency declarations`, t => {
    const root = mkdtempSync(join(tmpdir(), "paperclip-private-adapter-invalid-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const source = join(root, dir);
    const destination = join(root, "dest");
    mkdirSync(join(source, "dist", "server"), { recursive: true });
    writeFileSync(join(source, "package.json"), JSON.stringify({
      name, files: ["dist"], dependencies: { "fixture-runtime": "^1.0.0" },
    }));
    writeFileSync(join(source, "dist", "index.js"), "");
    const manifest = {
      version: "1.0.0", bundleDependencies: [name],
      dependencies: { [name]: "1.0.0", "fixture-runtime": "^2.0.0" },
    };
    assert.throws(() => stageUnpublishedAdapter(destination, manifest, name, { sourceRoot: root }), /build is missing/);
    writeFileSync(join(source, "dist", "server", "index.js"), "");
    assert.throws(() => stageUnpublishedAdapter(destination, manifest, name, { sourceRoot: root }), /fixture-runtime/);
  });
}

test("CLI bundles the unpublished adapters and the CLI and UI omit their registry dependencies", async t => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const temp = mkdtempSync(join(tmpdir(), "paperclip-private-artifacts-"));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const { default: config } = await import("../cli/esbuild.config.mjs");
  const require = createRequire(new URL("../cli/package.json", import.meta.url));
  const result = await require("esbuild").build({ ...config, absWorkingDir: join(root, "cli"), write: false, metafile: true, sourcemap: false });
  for (const [name, dir] of adapters) {
    assert.ok(Object.keys(result.metafile.inputs).some(input => input.includes(`${dir}/src/cli/format-event.ts`)), name);
  }
  const cliManifest = join(temp, "cli-package.json");
  execFileSync(process.execPath, [join(root, "scripts/generate-npm-package-json.mjs"), "--output", cliManifest]);
  const cliDependencies = JSON.parse(readFileSync(cliManifest, "utf8")).dependencies;
  mkdirSync(join(temp, "ui")); mkdirSync(join(temp, "scripts"));
  cpSync(join(root, "ui/package.json"), join(temp, "ui/package.json"));
  cpSync(join(root, "scripts/generate-ui-package-json.mjs"), join(temp, "scripts/generate-ui-package-json.mjs"));
  execFileSync(process.execPath, [join(temp, "scripts/generate-ui-package-json.mjs")]);
  const uiDependencies = JSON.parse(readFileSync(join(temp, "ui/package.json"), "utf8")).dependencies;
  for (const [name] of adapters) {
    assert.equal(cliDependencies?.[name], undefined);
    assert.equal(uiDependencies?.[name], undefined);
  }
});
