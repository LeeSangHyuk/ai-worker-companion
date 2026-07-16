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

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const SIDEBAR_MIN_WIDTH = 100;
const HEALTH_REFRESH_THROTTLE_MS = 1500;
const HEALTH_POLL_INTERVAL_MS = positiveInteger(process.env.AWC_HEALTH_POLL_INTERVAL_MS, 5000);
const HEALTH_STALE_AFTER_MS = positiveInteger(process.env.AWC_HEALTH_STALE_AFTER_MS, 15000);
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
let activeTuiCleanup = null;

export function replaceActiveTuiCleanup(nextCleanup) {
  if (activeTuiCleanup && activeTuiCleanup !== nextCleanup) activeTuiCleanup();
  activeTuiCleanup = nextCleanup;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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

function formatChildrenSummary(summary) {
  if (!summary || typeof summary.total !== "number" || summary.total === 0) return "none";
  const parts = [];
  for (const [key, label] of [
    ["failed", "failed"],
    ["stuck", "stuck"],
    ["active", "active"],
    ["quiet", "quiet"],
    ["unknown", "unknown"],
    ["idle", "idle"],
  ]) {
    if (summary[key] > 0) parts.push(`${summary[key]} ${label}`);
  }
  return parts.length > 0 ? parts.join(", ") : "none active";
}

function formatChildLine(child) {
  if (!child) return "";
  return `- ${oneLine(child.name ?? child.session_id ?? "child", 28)}: ${labelForHealth(child.health)}`;
}

function formatCheckedAt(value) {
  if (typeof value !== "number") return "unavailable";
  return new Date(value * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
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

export function executeWatcher(command, args, options) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout) => {
      if (error) {
        error.stdout = stdout;
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

async function readHealthState(directory, { signal } = {}) {
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
      refreshSucceeded: false,
      checkedAtMs: null,
    };
  }

  try {
    let result;
    try {
      const stdout = await executeWatcher(watcherCommand, [
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
        signal,
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
    const parent = result?.parent ?? null;
    const childrenSummary = result?.children_summary ?? null;
    const childDetails = Array.isArray(result?.children)
      ? result.children.filter((child) => child?.included !== false).slice(0, 5)
      : [];

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
      parentStatus: parent?.health ? labelForHealth(parent.health) : null,
      parentReason: parent?.reason ?? null,
      childrenSummary,
      childrenLabel: formatChildrenSummary(childrenSummary),
      childDetails,
      refreshSucceeded: typeof result?.checked_at === "number",
      checkedAtMs: typeof result?.checked_at === "number" ? result.checked_at * 1000 : null,
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
      parentStatus: null,
      parentReason: null,
      childrenSummary: null,
      childrenLabel: "none",
      childDetails: [],
      refreshSucceeded: false,
      checkedAtMs: null,
    };
  }
}

export function createHealthRefreshController({
  read,
  requestRender = () => {},
  now = () => Date.now(),
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  pollIntervalMs = HEALTH_POLL_INTERVAL_MS,
  staleAfterMs = HEALTH_STALE_AFTER_MS,
  throttleMs = HEALTH_REFRESH_THROTTLE_MS,
} = {}) {
  if (typeof read !== "function") throw new TypeError("read must be a function");

  let state = null;
  let lastSuccessfulRefreshAt = null;
  let lastRefreshAttemptAt = null;
  let timer = null;
  let inFlight = false;
  let activeAbortController = null;
  let disposed = false;

  async function refresh({ force = false } = {}) {
    const attemptedAt = now();
    if (disposed || inFlight) return false;
    if (!force && lastRefreshAttemptAt !== null && attemptedAt - lastRefreshAttemptAt < throttleMs) {
      return false;
    }
    lastRefreshAttemptAt = attemptedAt;
    inFlight = true;
    activeAbortController = new AbortController();

    let nextState;
    try {
      nextState = await read({ signal: activeAbortController.signal });
    } catch (error) {
      nextState = {
        health: "unknown",
        status: "Unknown",
        reason: `Failed to refresh Health data: ${error instanceof Error ? error.message : String(error)}`,
        currentState: "Health data is unavailable.",
        lastUpdate: "unavailable",
        refreshSucceeded: false,
        checkedAtMs: null,
      };
    } finally {
      inFlight = false;
      activeAbortController = null;
    }

    if (disposed) return false;

    if (nextState?.refreshSucceeded) {
      state = nextState;
      lastSuccessfulRefreshAt = nextState.checkedAtMs ?? attemptedAt;
      return true;
    }

    // Preserve the last successful observation across transient failures. The
    // stale guard below will stop presenting it as current once it ages out.
    if (state === null) state = nextState;
    return false;
  }

  function getState() {
    if (state === null) {
      return {
        health: "unknown",
        status: "Unknown",
        reason: "Health data is unavailable.",
        currentState: "Health data is unavailable.",
        lastUpdate: "unavailable",
      };
    }
    if (
      state !== null
      && lastSuccessfulRefreshAt !== null
      && now() - lastSuccessfulRefreshAt > staleAfterMs
    ) {
      return {
        ...state,
        health: "unknown",
        status: "Unknown",
        reason: "Health data is stale.",
        currentState: "Health data is stale.",
      };
    }
    return state;
  }

  async function tick() {
    try {
      await refresh({ force: true });
    } catch {
      // Keep the interval alive even if an injected clock or refresh adapter fails.
    }
    try {
      // A failed refresh must not terminate polling or suppress the stale UI.
      if (!disposed) requestRender();
    } catch {
      // A renderer failure must not terminate the polling interval either.
    }
  }

  function start() {
    if (disposed || timer !== null) return;
    timer = setIntervalFn(tick, pollIntervalMs);
    timer?.unref?.();
  }

  function stop() {
    disposed = true;
    if (timer !== null) {
      clearIntervalFn(timer);
      timer = null;
    }
    activeAbortController?.abort();
  }

  return {
    refresh,
    getState,
    start,
    stop,
    tick,
    isRefreshing: () => inFlight,
  };
}

export function registerHealthEventHandlers(eventBus, controller, requestRender) {
  if (!eventBus?.on) return [];
  return [...HEALTH_REFRESH_EVENTS].map((eventType) => eventBus.on(eventType, async () => {
    if (await controller.refresh()) requestRender();
  }));
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

function textNode(solid, props, value) {
  const node = solid.createElement("text");
  for (const [name, propValue] of Object.entries(props)) {
    solid.setProp(node, name, propValue);
  }
  solid.setProp(node, "content", value);
  return node;
}

export function updateOpenTuiTextNode(solid, node, value, fg) {
  solid.setProp(node, "content", String(value ?? ""));
  if (fg !== undefined) solid.setProp(node, "fg", fg);
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

function createSidebarSurface(solid, theme, state, debug) {
  const tone = statusColor(theme, state.status);
  const healthNode = textNode(solid, { fg: tone }, `Overall: ${state.status}`);
  const parentNode = textNode(solid, { fg: theme.textMuted }, `Parent: ${state.parentStatus ?? state.status}`);
  const childrenNode = textNode(solid, { fg: theme.textMuted }, `Children: ${state.childrenLabel ?? "none"}`);
  const childNodes = Array.from({ length: 5 }, (_, index) => textNode(
    solid,
    { fg: theme.textMuted },
    formatChildLine(state.childDetails?.[index]),
  ));
  const moreNode = textNode(solid, { fg: theme.textMuted }, state.childrenSummary?.more > 0 ? `+${state.childrenSummary.more} more` : "");
  const reasonNode = textNode(solid, { fg: theme.textMuted }, `Reason: ${oneLine(state.reason ?? state.currentState, 72)}`);
  const toolNode = textNode(solid, { fg: theme.textMuted }, `Tool: ${oneLine(formatToolDetail(state), 72)}`);
  const lastCheckNode = textNode(solid, { fg: theme.textMuted }, `Last Check: ${state.lastUpdate}`);
  const children = [healthNode, parentNode, childrenNode, ...childNodes, moreNode, reasonNode, toolNode, lastCheckNode];
  if (debug) {
    children.push(textNode(solid, { fg: theme.textMuted }, `debug: width=${debug.width} mode=${debug.mode}`));
  }

  const node = boxNode(
    solid,
    {
      borderStyle: "single",
      borderColor: theme.border,
      flexDirection: "column",
      padding: 1,
    },
    children,
  );
  return {
    node,
    update(nextState) {
      updateOpenTuiTextNode(solid, healthNode, `Overall: ${nextState.status}`, statusColor(theme, nextState.status));
      updateOpenTuiTextNode(solid, parentNode, `Parent: ${nextState.parentStatus ?? nextState.status}`);
      updateOpenTuiTextNode(solid, childrenNode, `Children: ${nextState.childrenLabel ?? "none"}`);
      for (let index = 0; index < childNodes.length; index += 1) {
        updateOpenTuiTextNode(solid, childNodes[index], formatChildLine(nextState.childDetails?.[index]));
      }
      updateOpenTuiTextNode(solid, moreNode, nextState.childrenSummary?.more > 0 ? `+${nextState.childrenSummary.more} more` : "");
      updateOpenTuiTextNode(solid, reasonNode, `Reason: ${oneLine(nextState.reason ?? nextState.currentState, 72)}`);
      updateOpenTuiTextNode(solid, toolNode, `Tool: ${oneLine(formatToolDetail(nextState), 72)}`);
      updateOpenTuiTextNode(solid, lastCheckNode, `Last Check: ${nextState.lastUpdate}`);
    },
  };
}

function createCompactStatus(solid, theme, state, debug) {
  const label = DEBUG_LAYOUT && debug ? `● ${state.status} · debug: width=${debug.width} mode=${debug.mode}` : `● ${state.status}`;
  const node = textNode(
    solid,
    { fg: statusColor(theme, state.status), wrapMode: "none" },
    label,
  );
  return {
    node,
    update(nextState) {
      const nextLabel = DEBUG_LAYOUT && debug
        ? `● ${nextState.status} · debug: width=${debug.width} mode=${debug.mode}`
        : `● ${nextState.status}`;
      updateOpenTuiTextNode(solid, node, nextLabel, statusColor(theme, nextState.status));
    },
  };
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

  // OpenCode may reload a TUI module before the previous lifecycle callback
  // runs. Stop the previous runtime defensively so only one poller survives.
  replaceActiveTuiCleanup(null);

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
  const surfaceBindings = new Set();
  let controller;
  function updateMountedSurfaces() {
    const nextState = controller.getState();
    for (const binding of [...surfaceBindings]) {
      try {
        binding.update(nextState);
      } catch {
        // A slot may be destroyed during navigation before lifecycle disposal.
        surfaceBindings.delete(binding);
      }
    }
    api.renderer?.requestRender?.();
  }
  controller = createHealthRefreshController({
    read: ({ signal }) => readHealthState(directory, { signal }),
    requestRender: updateMountedSurfaces,
  });
  await controller.refresh({ force: true });

  function renderCompactSurface() {
    const state = controller.getState();
    const debug = DEBUG_LAYOUT ? layoutDebug(api) : null;
    const binding = createCompactStatus(solid, api.theme.current, state, debug);
    surfaceBindings.add(binding);
    return binding.node;
  }

  const renderers = {
    session_prompt_right: renderCompactSurface,
    sidebar_content: () => {
      const state = controller.getState();
      const debug = DEBUG_LAYOUT ? layoutDebug(api) : null;
      if (isCompactLayout(api)) return null;
      const binding = createSidebarSurface(solid, api.theme.current, state, debug);
      surfaceBindings.add(binding);
      return binding.node;
    },
  };

  api.slots.register({
    order: 10000,
    slots: renderers,
  });
  controller.start();
  api.renderer?.requestRender?.();

  if (controller.getState().status === "Unknown") {
    api.ui?.toast?.({
      variant: "warning",
      title: "AI Worker Companion",
      message: "State input is unavailable.",
      duration: 4000,
    });
  }

  const removeEventHandlers = registerHealthEventHandlers(
    api.event,
    controller,
    updateMountedSurfaces,
  );

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    controller.stop();
    for (const remove of removeEventHandlers) remove();
    surfaceBindings.clear();
    if (activeTuiCleanup === cleanup) activeTuiCleanup = null;
  };
  replaceActiveTuiCleanup(cleanup);
  api.lifecycle?.onDispose?.(cleanup);
};
