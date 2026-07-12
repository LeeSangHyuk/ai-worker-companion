import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePaths } from "../cli/paths.js";
import { install, uninstall } from "../cli/install.js";

async function fixture(tui = null) {
  const home = await mkdtemp(join(tmpdir(), "awc-cli-"));
  const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, "config"), XDG_DATA_HOME: join(home, "data"), AWC_SKIP_DEPENDENCY_INSTALL: "1" };
  const paths = resolvePaths(env);
  if (tui) {
    await mkdir(join(paths.openCodeConfig), { recursive: true });
    await writeFile(paths.tuiConfig, `${JSON.stringify(tui, null, 2)}\n`);
  }
  return { env, paths };
}

test("install preserves OMO config and is idempotent", async () => {
  const { env, paths } = await fixture({ plugin: ["oh-my-openagent@latest"], theme: "custom" });
  await install(paths, { env });
  await install(paths, { env });
  const tui = JSON.parse(await readFile(paths.tuiConfig, "utf8"));
  assert.deepEqual(tui.plugin, ["oh-my-openagent@latest", "./tui-plugins/awc.js"]);
  assert.equal(tui.theme, "custom");
  await access(paths.watcher);
  await access(paths.plugin);
  const tuiEntry = await readFile(paths.tuiEntry, "utf8");
  assert.match(tuiEntry, /export default \{/);
  assert.match(tuiEntry, /id: "awc:tui"/);
  assert.match(tuiEntry, /tui,/);
});

test("uninstall removes only AWC entries", async () => {
  const { env, paths } = await fixture({ plugin: ["oh-my-openagent@latest"] });
  await install(paths, { env });
  await uninstall(paths);
  const tui = JSON.parse(await readFile(paths.tuiConfig, "utf8"));
  assert.deepEqual(tui.plugin, ["oh-my-openagent@latest"]);
  await assert.rejects(access(paths.manifest));
});

test("install rollback restores existing config", async () => {
  const original = { plugin: ["oh-my-openagent@latest"], keybinds: { test: "x" } };
  const { env, paths } = await fixture(original);
  env.AWC_TEST_FAIL_AFTER = "config";
  await assert.rejects(install(paths, { env }));
  assert.deepEqual(JSON.parse(await readFile(paths.tuiConfig, "utf8")), original);
  await assert.rejects(access(paths.manifest));
});

test("invalid JSON is never overwritten", async () => {
  const { env, paths } = await fixture();
  await mkdir(paths.openCodeConfig, { recursive: true });
  await writeFile(paths.tuiConfig, "{ invalid json\n");
  await assert.rejects(install(paths, { env }), /invalid JSON/);
  assert.equal(await readFile(paths.tuiConfig, "utf8"), "{ invalid json\n");
});
