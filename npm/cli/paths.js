import { homedir } from "node:os";
import { existsSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { delimiter, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));

export function getPackageVersion(packageJsonPath = join(packageRoot, "package.json")) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  if (!packageJson.version) throw new Error(`${packageJsonPath}: missing version`);
  return packageJson.version;
}

export function formatVersion(version = getPackageVersion()) {
  return `AI Worker Companion ${version}`;
}

function pathValue(env) {
  return env.PATH || env.Path || env.path || "";
}

function pathExtensions(env, platform) {
  if (platform !== "win32") return [""];
  return (env.PATHEXT || ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter(Boolean)
    .flatMap((extension) => [extension, extension.toLowerCase()]);
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function hasPathSeparator(command) {
  return command.includes("/") || command.includes("\\");
}

function findExecutable(command, { env = process.env, platform = process.platform } = {}) {
  const extensions = pathExtensions(env, platform);
  const candidates = [];
  if (hasPathSeparator(command)) candidates.push(command);
  else {
    for (const directory of pathValue(env).split(delimiter).filter(Boolean)) {
      candidates.push(join(directory, command));
    }
  }
  for (const candidate of candidates) {
    if (isFile(candidate)) return candidate;
    if (platform === "win32" && !extname(candidate)) {
      for (const extension of extensions) {
        const expanded = `${candidate}${extension}`;
        if (isFile(expanded)) return expanded;
      }
    }
  }
  return null;
}

function isWindowsCommandShim(path) {
  return /\.(cmd|bat)$/i.test(path);
}

function quoteForCmd(value) {
  return `"${String(value).replace(/(["^&|<>()%])/g, "^$1")}"`;
}

function windowsCommandShim(path, args, env) {
  return {
    command: env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", [path, ...args].map(quoteForCmd).join(" ")],
    resolved: path,
    via: "cmd-shim",
  };
}

export function resolveCommand(command, args = [], { env = process.env, platform = process.platform, nodeExecPath = process.execPath } = {}) {
  if (command === "npm" && env.npm_execpath) {
    if (platform === "win32" && isWindowsCommandShim(env.npm_execpath)) return windowsCommandShim(env.npm_execpath, args, env);
    if (/\.js$/i.test(env.npm_execpath)) {
      return {
        command: nodeExecPath,
        args: [env.npm_execpath, ...args],
        resolved: env.npm_execpath,
        via: "npm_execpath",
      };
    }
    return {
      command: env.npm_execpath,
      args,
      resolved: env.npm_execpath,
      via: "npm_execpath",
    };
  }

  const resolved = findExecutable(command, { env, platform });
  if (platform === "win32" && resolved && isWindowsCommandShim(resolved)) return windowsCommandShim(resolved, args, env);
  return {
    command: resolved || command,
    args,
    resolved: resolved || command,
    via: resolved ? "path" : "native-resolution",
  };
}

export function runCommand(command, args = [], { env = process.env, platform = process.platform, nodeExecPath = process.execPath, ...spawnOptions } = {}) {
  const resolved = resolveCommand(command, args, { env, platform, nodeExecPath });
  const result = spawnSync(resolved.command, resolved.args, {
    env,
    encoding: "utf8",
    shell: false,
    ...spawnOptions,
  });
  result.awcCommand = resolved;
  return result;
}

export function resolvePaths(env = process.env) {
  const home = resolve(env.HOME || homedir());
  const configHome = resolve(env.XDG_CONFIG_HOME || join(home, ".config"));
  const dataHome = resolve(env.XDG_DATA_HOME || join(home, ".local", "share"));
  const runtimeDir = resolve(env.AWC_RUNTIME_DIR || join(dataHome, "awc"));
  const openCodeConfig = join(configHome, "opencode");
  return {
    home,
    configHome,
    dataHome,
    runtimeDir,
    openCodeConfig,
    tuiConfig: join(openCodeConfig, "tui.json"),
    tuiEntry: join(openCodeConfig, "tui-plugins", "awc.js"),
    pluginEntry: join(openCodeConfig, "plugins", "awc.js"),
    manifest: join(runtimeDir, "manifest.json"),
    watcher: join(runtimeDir, "adapter", "db_health_watcher.ts"),
    retryParser: join(runtimeDir, "adapter", "provider_retry_parser.js"),
    retryCursor: join(runtimeDir, "provider-retry-cursor.json"),
    plugin: join(runtimeDir, "opencode", "agent-companion.js"),
    runtimePackage: join(runtimeDir, "package.json"),
    database: resolve(env.OPENCODE_DB || join(dataHome, "opencode", "opencode.db")),
  };
}
