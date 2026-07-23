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

function pathDelimiter(platform) {
  return platform === "win32" ? ";" : delimiter;
}

function envValue(env, name, platform) {
  if (env[name]) return env[name];
  if (platform !== "win32") return "";
  const match = Object.keys(env).find((key) => key.toLowerCase() === name.toLowerCase() && env[key]);
  return match ? env[match] : "";
}

function pathValues(env, platform) {
  if (platform !== "win32") return [env.PATH || ""].filter(Boolean);

  const values = [];
  const seenKeys = new Set();
  for (const name of ["Path", "PATH", "path"]) {
    if (env[name]) {
      values.push(env[name]);
      seenKeys.add(name);
    }
  }
  for (const key of Object.keys(env)) {
    if (key.toLowerCase() === "path" && env[key] && !seenKeys.has(key)) {
      values.push(env[key]);
      seenKeys.add(key);
    }
  }
  return values;
}

function pathExtensions(env, platform) {
  if (platform !== "win32") return [""];
  return (envValue(env, "PATHEXT", platform) || ".COM;.EXE;.BAT;.CMD")
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
  if (hasPathSeparator(command)) {
    if (platform === "win32" && !extname(command)) {
      for (const extension of extensions) {
        const expanded = `${command}${extension}`;
        if (isFile(expanded)) return expanded;
      }
    }
    return isFile(command) ? command : null;
  }

  const baseCandidates = [];
  for (const value of pathValues(env, platform)) {
    for (const directory of value.split(pathDelimiter(platform)).filter(Boolean)) {
      baseCandidates.push(join(directory, command));
    }
  }

  if (platform === "win32" && !extname(command)) {
    for (const candidate of baseCandidates) {
      for (const extension of extensions) {
        const expanded = `${candidate}${extension}`;
        if (isFile(expanded)) return expanded;
      }
    }
    return null;
  }

  for (const candidate of baseCandidates) {
    if (isFile(candidate)) return candidate;
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
    args: ["/d", "/s", "/c", `call ${[path, ...args].map(quoteForCmd).join(" ")}`],
    resolved: path,
    via: "cmd-shim",
    windowsVerbatimArguments: true,
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
    windowsVerbatimArguments: resolved.windowsVerbatimArguments,
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
