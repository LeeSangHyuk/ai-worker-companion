import { access, copyFile, mkdir, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { parseJsonFile, readOptional, restore, writeAtomic, writeJson } from "./files.js";

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const TUI_ENTRY = "./tui-plugins/awc.js";

function wrapper(target, exportName) {
  return `export { ${exportName} as default, ${exportName} } from ${JSON.stringify(pathToFileURL(target).href)};\n`;
}

function tuiWrapper(target) {
  const href = JSON.stringify(pathToFileURL(target).href);
  return `import { tui } from ${href};\n\nexport { tui };\n\nexport default {\n  id: "awc:tui",\n  tui,\n};\n`;
}

async function snapshot(paths) {
  return new Map(await Promise.all(paths.map(async (path) => [path, await readOptional(path)])));
}

async function rollback(snapshots) {
  for (const [path, previous] of [...snapshots.entries()].reverse()) await restore(path, previous);
}

function maybeFail(env, stage) {
  if (env.AWC_TEST_FAIL_AFTER === stage) throw new Error(`Injected failure after ${stage}`);
}

export async function install(paths, { env = process.env, skipDependencies = false } = {}) {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 24) throw new Error(`Node.js 24 or newer is required (current: ${process.version})`);
  const mutable = [paths.tuiConfig, paths.tuiEntry, paths.pluginEntry, paths.manifest, paths.watcher, paths.plugin, paths.runtimePackage];
  const before = await snapshot(mutable);
  try {
    await mkdir(dirname(paths.watcher), { recursive: true });
    await mkdir(dirname(paths.plugin), { recursive: true });
    await copyFile(join(packageRoot, "integrations/opencode/adapter/db_health_watcher.ts"), paths.watcher);
    await copyFile(join(packageRoot, "integrations/opencode/.opencode/plugins/agent-companion.js"), paths.plugin);
    maybeFail(env, "runtime");

    const tui = await parseJsonFile(paths.tuiConfig, { plugin: [] });
    if (!Array.isArray(tui.plugin)) throw new Error(`${paths.tuiConfig}: plugin must be an array`);
    if (!tui.plugin.includes(TUI_ENTRY)) tui.plugin.push(TUI_ENTRY);
    await writeJson(paths.tuiConfig, tui);
    await writeAtomic(paths.tuiEntry, tuiWrapper(paths.plugin));
    await writeAtomic(paths.pluginEntry, wrapper(paths.plugin, "AgentCompanionPlugin"));

    const runtimePackage = {
      private: true,
      type: "module",
      dependencies: { "@opentui/solid": "^0.2.16" },
    };
    await writeJson(paths.runtimePackage, runtimePackage);
    maybeFail(env, "config");

    if (!skipDependencies && env.AWC_SKIP_DEPENDENCY_INSTALL !== "1") {
      const npm = spawnSync("npm", ["install", "--omit=dev", "--ignore-scripts"], {
        cwd: paths.runtimeDir,
        env,
        encoding: "utf8",
      });
      if (npm.status !== 0) throw new Error(`npm install failed: ${npm.stderr || npm.stdout}`);
    }

    await writeJson(paths.manifest, {
      version: 1,
      installedAt: new Date().toISOString(),
      runtimeDir: paths.runtimeDir,
      tuiEntry: TUI_ENTRY,
      files: [paths.watcher, paths.plugin, paths.tuiEntry, paths.pluginEntry],
    });
    return { changed: true, runtimeDir: paths.runtimeDir };
  } catch (error) {
    await rollback(before);
    throw error;
  }
}

export async function uninstall(paths) {
  const tui = await parseJsonFile(paths.tuiConfig, { plugin: [] });
  if (Array.isArray(tui.plugin)) {
    tui.plugin = tui.plugin.filter((entry) => entry !== TUI_ENTRY);
    await writeJson(paths.tuiConfig, tui);
  }
  await rm(paths.tuiEntry, { force: true });
  await rm(paths.pluginEntry, { force: true });
  await rm(paths.runtimeDir, { recursive: true, force: true });
  return { removed: true };
}

export async function isInstalled(paths) {
  try {
    await access(paths.manifest, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
