import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { arch, platform } from "node:os";
import { parseJsonFile } from "./files.js";
import { getPackageVersion, runCommand } from "./paths.js";

async function readable(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function doctorReport(paths, { env = process.env } = {}) {
  const checks = [];
  const major = Number(process.versions.node.split(".")[0]);
  checks.push({ name: "Node 24+", ok: major >= 24, detail: process.version });

  const openCode = runCommand("opencode", ["--version"], { env });
  const openCodeVersion = openCode.status === 0 ? openCode.stdout.trim() : null;
  checks.push({ name: "OpenCode", ok: openCode.status === 0, detail: openCodeVersion || "not found" });
  checks.push({ name: "AWC manifest", ok: await readable(paths.manifest), detail: paths.manifest });
  checks.push({ name: "Health watcher", ok: await readable(paths.watcher), detail: paths.watcher });
  const watcherSyntax = runCommand(process.execPath, ["--check", paths.watcher], { env });
  checks.push({ name: "Health watcher syntax", ok: watcherSyntax.status === 0, detail: watcherSyntax.status === 0 ? "valid" : (watcherSyntax.stderr || "invalid").trim() });
  checks.push({ name: "Provider retry parser", ok: await readable(paths.retryParser), detail: paths.retryParser });
  const retryParserSyntax = runCommand(process.execPath, ["--check", paths.retryParser], { env });
  checks.push({ name: "Provider retry parser syntax", ok: retryParserSyntax.status === 0, detail: retryParserSyntax.status === 0 ? "valid" : (retryParserSyntax.stderr || "invalid").trim() });
  checks.push({ name: "TUI entrypoint", ok: await readable(paths.tuiEntry), detail: paths.tuiEntry });
  checks.push({ name: "Plugin entrypoint", ok: await readable(paths.pluginEntry), detail: paths.pluginEntry });
  const tui = await parseJsonFile(paths.tuiConfig, { plugin: [] });
  checks.push({ name: "TUI registration", ok: Array.isArray(tui.plugin) && tui.plugin.includes("./tui-plugins/awc.js"), detail: paths.tuiConfig });
  checks.push({ name: "@opentui/solid", ok: await readable(`${paths.runtimeDir}/node_modules/@opentui/solid/package.json`), detail: "run awc install to repair" });
  checks.push({ name: "OpenCode database", ok: await readable(paths.database), detail: paths.database });
  return {
    summary: {
      awcVersion: getPackageVersion(),
      nodeVersion: process.version,
      platform: `${platform()}-${arch()}`,
      openCodeVersion,
      runtimeDir: paths.runtimeDir,
      plugin: paths.plugin,
    },
    checks,
  };
}

export function formatDoctorReport(report) {
  const lines = [
    "AI Worker Companion Doctor",
    "",
    `AWC      : ${report.summary.awcVersion}`,
    `Node     : ${report.summary.nodeVersion}`,
    `Platform : ${report.summary.platform}`,
    `OpenCode : ${report.summary.openCodeVersion || "not found"}`,
    `Runtime  : ${report.summary.runtimeDir}`,
    `Plugin   : ${report.summary.plugin}`,
    "",
    ...report.checks.map((check) => `${check.ok ? "PASS" : "FAIL"}: ${check.name} (${check.detail})`),
  ];
  return lines.join("\n");
}

export async function doctor(paths, options = {}) {
  return (await doctorReport(paths, options)).checks;
}
