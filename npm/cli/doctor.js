import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseJsonFile } from "./files.js";

async function readable(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function doctor(paths, { env = process.env } = {}) {
  const checks = [];
  const major = Number(process.versions.node.split(".")[0]);
  checks.push({ name: "Node 24+", ok: major >= 24, detail: process.version });

  const openCode = spawnSync("opencode", ["--version"], { env, encoding: "utf8" });
  checks.push({ name: "OpenCode", ok: openCode.status === 0, detail: openCode.status === 0 ? openCode.stdout.trim() : "not found" });
  checks.push({ name: "AWC manifest", ok: await readable(paths.manifest), detail: paths.manifest });
  checks.push({ name: "Health watcher", ok: await readable(paths.watcher), detail: paths.watcher });
  const watcherSyntax = spawnSync(process.execPath, ["--check", paths.watcher], { env, encoding: "utf8" });
  checks.push({ name: "Health watcher syntax", ok: watcherSyntax.status === 0, detail: watcherSyntax.status === 0 ? "valid" : (watcherSyntax.stderr || "invalid").trim() });
  checks.push({ name: "TUI entrypoint", ok: await readable(paths.tuiEntry), detail: paths.tuiEntry });
  checks.push({ name: "Plugin entrypoint", ok: await readable(paths.pluginEntry), detail: paths.pluginEntry });
  const tui = await parseJsonFile(paths.tuiConfig, { plugin: [] });
  checks.push({ name: "TUI registration", ok: Array.isArray(tui.plugin) && tui.plugin.includes("./tui-plugins/awc.js"), detail: paths.tuiConfig });
  checks.push({ name: "@opentui/solid", ok: await readable(`${paths.runtimeDir}/node_modules/@opentui/solid/package.json`), detail: "run awc install to repair" });
  checks.push({ name: "OpenCode database", ok: await readable(paths.database), detail: paths.database });
  return checks;
}
