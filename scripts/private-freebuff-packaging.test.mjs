import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { prepareBundledPackage, stagePrivateFreebuff } from "./prepare-bundled-package.mjs";

const adapterName = "@paperclipai/adapter-freebuff-local";

test("offline consumer loads the unpublished bundled adapter", t => {
  const root = mkdtempSync(join(tmpdir(), "paperclip-private-adapter-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "source", "packages", "adapters", "freebuff-local");
  const sourceRoot = join(root, "source"), serverSource = join(sourceRoot, "server");
  const dest = join(root, "server"), consumer = join(root, "consumer");
  mkdirSync(join(source, "dist"), { recursive: true });
  mkdirSync(join(serverSource, "dist"), { recursive: true }); mkdirSync(consumer, { recursive: true });
  writeFileSync(join(sourceRoot, "package.json"), "{}");
  writeFileSync(join(source, "dist", "index.js"), "module.exports = 42;\n");
  writeFileSync(join(source, "package.json"), JSON.stringify({ name: adapterName, version: "0.1.0", files: ["dist"], main: "dist/index.js" }));
  const manifest = { name: "paperclip-private-server-fixture", version: "1.2.3", main: "dist/index.js", files: ["dist"], dependencies: { [adapterName]: "1.2.3" }, bundleDependencies: [adapterName] };
  writeFileSync(join(serverSource, "package.json"), JSON.stringify(manifest));
  writeFileSync(join(serverSource, "dist", "index.js"), `module.exports = require(${JSON.stringify(adapterName)});`);
  prepareBundledPackage(serverSource, dest, { sourceRoot });
  const staged = JSON.parse(readFileSync(join(dest, "node_modules", adapterName, "package.json"), "utf8"));
  assert.equal(staged.version, "1.2.3");
  execFileSync("npm", ["pack", "--offline", "--silent", "--pack-destination", root], { cwd: dest });
  execFileSync("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", join(root, "paperclip-private-server-fixture-1.2.3.tgz")], { cwd: consumer });
  const result = execFileSync(process.execPath, ["-e", "console.log(require('paperclip-private-server-fixture'))"], { cwd: consumer, encoding: "utf8" });
  assert.equal(result.trim(), "42");
});

test("missing private adapter build fails closed", t => {
  const root = mkdtempSync(join(tmpdir(), "paperclip-private-adapter-missing-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "packages", "adapters", "freebuff-local");
  mkdirSync(source, { recursive: true });
  writeFileSync(join(source, "package.json"), JSON.stringify({ name: adapterName, files: ["dist"] }));
  assert.throws(() => stagePrivateFreebuff(join(root, "dest"), { version: "1.0.0", bundleDependencies: [adapterName], dependencies: { [adapterName]: "1.0.0" } }, { sourceRoot: root }));
});


test("private adapter dependencies must match those installed by the server", t => {
  const root = mkdtempSync(join(tmpdir(), "paperclip-private-adapter-deps-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "packages", "adapters", "freebuff-local");
  mkdirSync(join(source, "dist"), { recursive: true });
  writeFileSync(join(source, "dist", "index.js"), "module.exports = 1");
  writeFileSync(join(source, "package.json"), JSON.stringify({ name: adapterName, files: ["dist"], dependencies: { "fixture-runtime": "^1.0.0" } }));
  const manifest = { version: "1.0.0", bundleDependencies: [adapterName], dependencies: { [adapterName]: "1.0.0", "fixture-runtime": "^2.0.0" } };
  assert.throws(() => stagePrivateFreebuff(join(root, "dest"), manifest, { sourceRoot: root }), /fixture-runtime/);
});


test("CLI bundles Freebuff and the CLI and UI publish manifests do not require it", async t => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const temp = mkdtempSync(join(tmpdir(), "paperclip-private-artifacts-"));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const { default: config } = await import("../cli/esbuild.config.mjs");
  const require = createRequire(new URL("../cli/package.json", import.meta.url));
  const result = await require("esbuild").build({ ...config, absWorkingDir: join(root, "cli"), write: false, metafile: true, sourcemap: false });
  assert.ok(Object.keys(result.metafile.inputs).some(name => name.includes("freebuff-local/src/cli/format-event.ts")));
  const cliManifest = join(temp, "cli-package.json");
  execFileSync(process.execPath, [join(root, "scripts/generate-npm-package-json.mjs"), "--output", cliManifest]);
  assert.equal(JSON.parse(readFileSync(cliManifest, "utf8")).dependencies?.[adapterName], undefined);
  mkdirSync(join(temp, "ui")); mkdirSync(join(temp, "scripts"));
  cpSync(join(root, "ui/package.json"), join(temp, "ui/package.json"));
  cpSync(join(root, "scripts/generate-ui-package-json.mjs"), join(temp, "scripts/generate-ui-package-json.mjs"));
  execFileSync(process.execPath, [join(temp, "scripts/generate-ui-package-json.mjs")]);
  assert.equal(JSON.parse(readFileSync(join(temp, "ui/package.json"), "utf8")).dependencies?.[adapterName], undefined);
});
