import { homedir } from "node:os";
import { join, resolve } from "node:path";

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
