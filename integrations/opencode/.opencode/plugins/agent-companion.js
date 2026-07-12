// Minimal OpenCode plugin skeleton for AI Worker Companion.
//
// This is intentionally conservative:
// - no LLM API calls
// - no extractor/schema/session_state.py changes
// - no automatic recovery
// - no automatic new session execution
//
// The working MVP path is the slash command in .opencode/commands.
// This plugin exists to validate future status/notification hooks.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const SIDEBAR_MIN_WIDTH = 100;
const HEALTH_REFRESH_THROTTLE_MS = 1500;
const DEBUG_LAYOUT = process.env.COMPANION_DEBUG_LAYOUT === "1";
const DEFAULT_OPENCODE_DB = join(homedir(), ".local/share/opencode/opencode.db");
const HEALTH_REFRESH_EVENTS = new Set([
  "command.executed",
  "message.part.delta",
  "message.part.updated",
  "message.updated",
  "session.created",
  "session.diff",
  "session.error",
  "session.idle",
  "session.status",
  "session.updated",
  "session.next.shell.started",
  "session.next.shell.ended",
  "session.next.step.started",
  "session.next.step.ended",
  "session.next.step.failed",
  "session.next.tool.called",
  "session.next.tool.progress",
  "session.next.tool.success",
  "session.next.tool.failed",
]);

function repoRootFromDirectory(directory) {
  return resolve(directory ?? process.cwd());
}

function labelForHealth(health) {
  switch (health) {
    case "active":
      return "Active";
    case "quiet":
      return "Quiet";
    case "stuck":
      return "Stuck";
    case "failed":
      return "Failed";
    case "idle":
      return "Idle";
    case "unknown":
      return "Unknown";
    default:
      return "Unknown";
  }
}

function compactToolSummary(result) {
  const command = result?.tool?.command;
  const elapsed = result?.tool?.elapsed_seconds;
  if (!command) return null;
  if (typeof elapsed === "number") return `${command} · ${elapsed}s`;
  return command;
}

function statusColor(theme, status) {
  switch (status) {
    case "Active":
      return theme.success ?? theme.info;
    case "Quiet":
      return theme.warning ?? theme.info;
    case "Stuck":
    case "Failed":
      return theme.error ?? theme.warning;
    case "Unknown":
      return theme.warning ?? theme.textMuted;
    case "Idle":
    default:
      return theme.textMuted;
  }
}

function formatToolDetail(state) {
  const parts = [];
  if (state.toolName) parts.push(state.toolName);
  if (state.toolStatus) parts.push(state.toolStatus);
  if (state.toolCommand) parts.push(state.toolCommand);
  if (typeof state.toolElapsedSeconds === "number") parts.push(`${state.toolElapsedSeconds}s`);
  if (typeof state.toolExit === "number") parts.push(`exit ${state.toolExit}`);
  return parts.length > 0 ? parts.join(" · ") : "none";
}

function formatCheckedAt(value) {
  if (typeof value !== "number") return "unavailable";
  return new Date(value * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseWatcherOutput(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

function readHealthState(directory) {
  const root = repoRootFromDirectory(directory);
  const runtimeDir = process.env.AWC_RUNTIME_DIR ?? join(homedir(), ".local/share/awc");
  const installedWatcher = join(runtimeDir, "adapter/db_health_watcher.ts");
  const repositoryTypeScriptWatcher = join(root, "integrations/opencode/adapter/db_health_watcher.ts");
  const repositoryPythonWatcher = join(root, "integrations/opencode/adapter/db_health_watcher.py");
  const watcherPath = process.env.AWC_HEALTH_WATCHER
    ?? [installedWatcher, repositoryTypeScriptWatcher, repositoryPythonWatcher].find(existsSync)
    ?? installedWatcher;
  const watcherCommand = watcherPath.endsWith(".py") ? "python3" : (process.env.AWC_NODE ?? "node");
  const dbPath = process.env.OPENCODE_DB ?? DEFAULT_OPENCODE_DB;

  if (!existsSync(watcherPath)) {
    return {
      health: "unknown",
      status: "Unknown",
      reason: `Health watcher not found at ${watcherPath}`,
      currentState: `Health watcher not found at ${watcherPath}`,
      lastUpdate: "unavailable",
      source: watcherPath,
      toolName: null,
      toolCommand: null,
      toolStatus: null,
      toolElapsedSeconds: null,
      toolExit: null,
    };
  }

  try {
    let result;
    try {
      const stdout = execFileSync(watcherCommand, [
        watcherPath,
        "--db",
        dbPath,
        "--session",
        "latest",
        "--once",
      ], {
        cwd: root,
        encoding: "utf8",
        timeout: 3000,
        stdio: ["ignore", "pipe", "pipe"],
      });
      result = JSON.parse(stdout);
    } catch (error) {
      result = parseWatcherOutput(error?.stdout);
      if (!result) throw error;
    }
    const toolSummary = compactToolSummary(result);
    const reason = result?.reason ?? "No health reason returned by watcher.";
    const health = result?.health ?? "unknown";
    const tool = result?.tool ?? {};

    return {
      health,
      status: labelForHealth(health),
      reason,
      currentState: toolSummary ? `${reason} (${toolSummary})` : reason,
      lastUpdate: formatCheckedAt(result?.checked_at),
      source: result?.source ?? dbPath,
      toolName: tool?.name ?? null,
      toolCommand: tool?.command ?? null,
      toolStatus: tool?.status ?? null,
      toolElapsedSeconds: tool?.elapsed_seconds ?? null,
      toolExit: tool?.exit ?? null,
    };
  } catch (error) {
    const reason = `Failed to read Health watcher output: ${error instanceof Error ? error.message : String(error)}`;
    return {
      health: "unknown",
      status: "Unknown",
      reason,
      currentState: reason,
      lastUpdate: "unavailable",
      source: watcherPath,
      toolName: null,
      toolCommand: null,
      toolStatus: null,
      toolElapsedSeconds: null,
      toolExit: null,
    };
  }
}

function oneLine(value, max = 96) {
  const line = String(value ?? "").replace(/\s+/g, " ").trim();
  if (line.length <= max) return line;
  return `${line.slice(0, max - 3)}...`;
}

function isCompactLayout(api) {
  const width = api?.renderer?.width ?? process.stdout.columns ?? 80;
  return width < SIDEBAR_MIN_WIDTH;
}

function layoutDebug(api) {
  const width = api?.renderer?.width ?? process.stdout.columns ?? 80;
  const mode = width < SIDEBAR_MIN_WIDTH ? "compact" : "wide";
  return { width, mode };
}

function shouldRefreshHealth(eventType) {
  return HEALTH_REFRESH_EVENTS.has(eventType);
}

function textNode(solid, props, value) {
  const node = solid.createElement("text");
  for (const [name, propValue] of Object.entries(props)) {
    solid.setProp(node, name, propValue);
  }
  solid.insert(node, value);
  return node;
}

function boxNode(solid, props, children) {
  const node = solid.createElement("box");
  for (const [name, propValue] of Object.entries(props)) {
    solid.setProp(node, name, propValue);
  }
  for (const child of children) {
    solid.insert(node, child);
  }
  return node;
}

function renderSidebarSurface(solid, theme, state, debug) {
  const tone = statusColor(theme, state.status);
  const children = [
    textNode(solid, { fg: tone }, `Health: ${state.status}`),
    textNode(solid, { fg: theme.textMuted }, `Reason: ${oneLine(state.reason ?? state.currentState, 72)}`),
    textNode(solid, { fg: theme.textMuted }, `Tool: ${oneLine(formatToolDetail(state), 72)}`),
    textNode(solid, { fg: theme.textMuted }, `Last Update: ${state.lastUpdate}`),
  ];
  if (debug) {
    children.push(textNode(solid, { fg: theme.textMuted }, `debug: width=${debug.width} mode=${debug.mode}`));
  }

  return boxNode(
    solid,
    {
      borderStyle: "single",
      borderColor: theme.border,
      flexDirection: "column",
      padding: 1,
    },
    children,
  );
}

function renderCompactStatus(solid, theme, state, debug) {
  const label = DEBUG_LAYOUT && debug ? `● ${state.status} · debug: width=${debug.width} mode=${debug.mode}` : `● ${state.status}`;
  return textNode(
    solid,
    { fg: statusColor(theme, state.status), wrapMode: "none" },
    label,
  );
}

export const AgentCompanionPlugin = async ({ client }) => {
  async function log(level, message, extra = {}) {
    if (!client?.app?.log) return;
    await client.app.log({
      body: {
        service: "agent-session-state-extractor",
        level,
        message,
        extra,
      },
    });
  }

  await log("info", "AI Worker Companion OpenCode plugin skeleton initialized");

  return {
    event: async ({ event }) => {
      if (!event?.type) return;

      if (event.type === "session.idle") {
        await log("info", "Session idle observed. Companion handoff can be requested with /companion-handoff.", {
          eventType: event.type,
        });
      }

      if (event.type === "session.error") {
        await log("warn", "Session error observed. Companion state can be requested with /companion-state.", {
          eventType: event.type,
        });
      }

      if (event.type === "session.status") {
        await log("debug", "Session status event observed.", {
          eventType: event.type,
        });
      }
    },
  };
};

export const tui = async (api, _options, meta) => {
  if (!api?.slots?.register) return {};

  const solid = await import("@opentui/solid").catch(() => null);
  if (!solid) {
    api.ui?.toast?.({
      variant: "warning",
      title: "AI Worker Companion",
      message: "Cannot load @opentui/solid for Companion status surface.",
      duration: 4000,
    });
    return;
  }

  const directory = api.state?.path?.directory ?? process.cwd();
  let state = readHealthState(directory);
  let lastHealthRefreshAt = Date.now();

  function refreshHealth({ force = false } = {}) {
    const now = Date.now();
    if (!force && now - lastHealthRefreshAt < HEALTH_REFRESH_THROTTLE_MS) return false;

    state = readHealthState(directory);
    lastHealthRefreshAt = now;
    return true;
  }

  function renderCompactSurface() {
    refreshHealth();
    const debug = DEBUG_LAYOUT ? layoutDebug(api) : null;
    return renderCompactStatus(solid, api.theme.current, state, debug);
  }

  const renderers = {
    session_prompt_right: renderCompactSurface,
    sidebar_content: () => {
      refreshHealth();
      const debug = DEBUG_LAYOUT ? layoutDebug(api) : null;
      return isCompactLayout(api) ? null : renderSidebarSurface(solid, api.theme.current, state, debug);
    },
  };

  api.slots.register({
    order: 10000,
    slots: renderers,
  });
  api.renderer?.requestRender?.();

  if (state.status === "Unknown") {
    api.ui?.toast?.({
      variant: "warning",
      title: "AI Worker Companion",
      message: "State input is unavailable.",
      duration: 4000,
    });
  }

  return {
    event: async ({ event }) => {
      if (!shouldRefreshHealth(event?.type)) return;
      if (refreshHealth()) {
        api.renderer?.requestRender?.();
      }
    },
  };
};
