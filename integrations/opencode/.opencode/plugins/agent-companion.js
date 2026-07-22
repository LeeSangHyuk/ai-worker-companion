// OpenCode TUI plugin for AI Worker Companion.
//
// This is intentionally conservative:
// - no LLM API calls
// - no automatic recovery
// - no automatic new session execution
// - no Health policy in the View layer

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const SIDEBAR_MIN_WIDTH = 100;
const HEALTH_REFRESH_THROTTLE_MS = 1500;
const HEALTH_POLL_INTERVAL_MS = positiveInteger(process.env.AWC_HEALTH_POLL_INTERVAL_MS, 5000);
const HEALTH_STALE_AFTER_MS = positiveInteger(process.env.AWC_HEALTH_STALE_AFTER_MS, 15000);
const NOTIFICATION_COOLDOWN_MS = positiveInteger(process.env.AWC_NOTIFICATION_COOLDOWN_MS, 30000);
const NOTIFICATION_MODES = new Set(["off", "problems-only", "all"]);
const NOTIFICATION_LOCK_STALE_MS = positiveInteger(process.env.AWC_NOTIFICATION_LOCK_STALE_MS, 6 * 60 * 60 * 1000);
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
let activePluginNotificationCleanup = null;
let activePluginNotificationRuntime = null;

export function replaceActiveTuiCleanup(nextCleanup) {
  if (activeTuiCleanup && activeTuiCleanup !== nextCleanup) activeTuiCleanup();
  activeTuiCleanup = nextCleanup;
}

export function replaceActivePluginNotificationCleanup(nextCleanup) {
  const slot = sharedPluginNotificationRuntimeSlot();
  const currentCleanup = slot.cleanup ?? activePluginNotificationCleanup;
  if (currentCleanup && currentCleanup !== nextCleanup) currentCleanup();
  activePluginNotificationCleanup = nextCleanup;
  slot.cleanup = nextCleanup;
  if (nextCleanup === null) {
    activePluginNotificationRuntime = null;
    slot.runtime = null;
  }
}

export function createNotificationStore() {
  return { lastNotification: null };
}

function sharedNotificationStore() {
  const key = "__awcNotificationStore";
  globalThis[key] ??= createNotificationStore();
  return globalThis[key];
}

function sharedPluginNotificationRuntimeSlot() {
  const key = "__awcPluginNotificationRuntime";
  globalThis[key] ??= { runtime: null, cleanup: null };
  return globalThis[key];
}

export function resetSharedPluginNotificationRuntime() {
  replaceActivePluginNotificationCleanup(null);
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function notificationLockPath(env = process.env) {
  const runtimeDir = env.AWC_RUNTIME_DIR ?? join(homedir(), ".local/share/awc");
  return env.AWC_NOTIFICATION_LOCK_PATH ?? join(runtimeDir, "plugin-notification.lock");
}

function readLockOwner(path) {
  try {
    return JSON.parse(readFileSync(join(path, "owner.json"), "utf8"));
  } catch {
    return null;
  }
}

export function acquirePluginNotificationLock({
  env = process.env,
  now = () => Date.now(),
  pid = process.pid,
  staleMs = NOTIFICATION_LOCK_STALE_MS,
} = {}) {
  const path = notificationLockPath(env);
  const create = () => {
    mkdirSync(dirname(path), { recursive: true });
    mkdirSync(path);
    writeFileSync(join(path, "owner.json"), JSON.stringify({
      pid,
      createdAt: now(),
    }));
    return {
      acquired: true,
      path,
      release() {
        rmSync(path, { recursive: true, force: true });
      },
    };
  };

  try {
    return create();
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }

  const owner = readLockOwner(path);
  const ownerPid = Number(owner?.pid);
  const createdAt = Number(owner?.createdAt);
  const stale = !Number.isFinite(createdAt) || now() - createdAt > staleMs;
  if (!processIsAlive(ownerPid) || stale) {
    rmSync(path, { recursive: true, force: true });
    return create();
  }

  return {
    acquired: false,
    path,
    ownerPid,
    release() {},
  };
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function enabledFlag(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

export function resolveNotificationMode({ mode, enabled } = {}) {
  if (mode !== undefined && mode !== null && String(mode).trim() !== "") {
    const normalized = String(mode).trim().toLowerCase();
    return NOTIFICATION_MODES.has(normalized) ? normalized : "off";
  }
  return enabledFlag(enabled) ? "all" : "off";
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

function stateHealth(state) {
  return typeof state?.health === "string" ? state.health : String(state?.status ?? "").toLowerCase();
}

function stateSessionId(state) {
  return state?.sessionId ?? state?.session?.id ?? null;
}

function stateSessionTitle(state) {
  return state?.sessionTitle ?? state?.session?.title ?? null;
}

function stateProviderRetryActive(state) {
  return state?.providerRetry?.active === true || state?.provider_retry?.active === true;
}

function notificationSessionSuffix(state) {
  const title = oneLine(stateSessionTitle(state) ?? stateSessionId(state) ?? "", 48);
  return title ? `\nSession: ${title}` : "";
}

export function selectHealthNotification(previous, current) {
  if (!previous || !current) return null;
  const previousSessionId = stateSessionId(previous);
  const currentSessionId = stateSessionId(current);
  if (!previousSessionId || !currentSessionId || previousSessionId !== currentSessionId) return null;

  const from = stateHealth(previous);
  const to = stateHealth(current);
  if (!from || !to || from === to) return null;

  const activeStates = new Set(["active", "quiet", "stuck"]);
  const sessionSuffix = notificationSessionSuffix(current);
  const base = {
    sessionId: currentSessionId,
    from,
    to,
    checkedAtMs: current.checkedAtMs ?? null,
  };

  if (activeStates.has(from) && to === "idle") {
    return {
      ...base,
      type: "completed",
      title: "AWC — 작업 완료",
      message: `OpenCode 작업이 완료되었습니다.${sessionSuffix}`,
    };
  }

  if (["active", "quiet"].includes(from) && to === "stuck") {
    if (stateProviderRetryActive(current)) {
      return {
        ...base,
        type: "provider_retry",
        title: "AWC — Provider retry",
        message: `모델 제공자의 반복 재시도로 작업이 지연되고 있습니다.${sessionSuffix}`,
      };
    }
    return {
      ...base,
      type: "attention",
      title: "AWC — 확인 필요",
      message: `작업이 진행되지 않고 있습니다.${sessionSuffix}`,
    };
  }

  if (activeStates.has(from) && to === "failed") {
    return {
      ...base,
      type: "failed",
      title: "AWC — 작업 실패",
      message: `OpenCode 작업이 실패했습니다.${sessionSuffix}`,
    };
  }

  return null;
}

function notificationKey(notification) {
  return [
    notification.sessionId ?? "",
    notification.type ?? "",
    notification.from ?? "",
    notification.to ?? "",
  ].join("\u0000");
}

function allowsNotificationMode(mode, notification) {
  if (mode === "all") return true;
  if (mode === "problems-only") return notification?.type !== "completed";
  return false;
}

function appleScriptString(value) {
  return `"${String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

export function createMacOSNotifier({
  execFileFn = execFile,
  platformName = process.platform,
  timeoutMs = 3000,
} = {}) {
  return {
    notify(notification) {
      if (platformName !== "darwin") return Promise.resolve({ ok: false, skipped: "unsupported_platform" });
      const script = `display notification ${appleScriptString(notification.message)} with title ${appleScriptString(notification.title)}`;
      return new Promise((resolveNotify) => {
        execFileFn("osascript", ["-e", script], { timeout: timeoutMs }, (error) => {
          resolveNotify({
            ok: !error,
            error: error ? (error.message ?? String(error)) : null,
          });
        });
      });
    },
  };
}

export function createDefaultNotifier() {
  return createMacOSNotifier();
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
      sessionId: null,
      sessionTitle: null,
      providerRetry: { active: false },
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
      sessionId: result?.session?.id ?? null,
      sessionTitle: result?.session?.title ?? null,
      providerRetry: result?.provider_retry ?? { active: false },
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
      sessionId: null,
      sessionTitle: null,
      providerRetry: { active: false },
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
  notifier = null,
  notificationEnabled = false,
  notificationMode,
  notificationCooldownMs = NOTIFICATION_COOLDOWN_MS,
  notificationStore = createNotificationStore(),
} = {}) {
  if (typeof read !== "function") throw new TypeError("read must be a function");

  const effectiveNotificationMode = resolveNotificationMode({
    mode: notificationMode,
    enabled: notificationEnabled,
  });

  let state = null;
  let lastSuccessfulRefreshAt = null;
  let lastRefreshAttemptAt = null;
  let timer = null;
  let inFlight = false;
  let activeAbortController = null;
  let disposed = false;

  async function maybeNotify(previousState, nextState, attemptedAt) {
    if (effectiveNotificationMode === "off" || !notifier?.notify) return;
    const notification = selectHealthNotification(previousState, nextState);
    if (!notification) return;
    if (!allowsNotificationMode(effectiveNotificationMode, notification)) return;
    const key = notificationKey(notification);
    const previousNotification = notificationStore.lastNotification;
    if (
      previousNotification
      && previousNotification.key === key
      && attemptedAt - previousNotification.sentAt < notificationCooldownMs
    ) {
      return;
    }
    notificationStore.lastNotification = { key, sentAt: attemptedAt };
    try {
      await notifier.notify(notification);
    } catch {
      // Notification failures must never stop Health polling.
    }
  }

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
      const previousState = state;
      state = nextState;
      lastSuccessfulRefreshAt = nextState.checkedAtMs ?? attemptedAt;
      await maybeNotify(previousState, nextState, attemptedAt);
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

export async function startPluginNotificationController({
  directory,
  env = process.env,
  read = ({ signal }) => readHealthState(directory, { signal }),
  notifier = createDefaultNotifier(),
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  now = () => Date.now(),
  pollIntervalMs = HEALTH_POLL_INTERVAL_MS,
  staleAfterMs = HEALTH_STALE_AFTER_MS,
  throttleMs = HEALTH_REFRESH_THROTTLE_MS,
  notificationCooldownMs = NOTIFICATION_COOLDOWN_MS,
  notificationStore = sharedNotificationStore(),
  log = async () => {},
} = {}) {
  const mode = resolveNotificationMode({
    mode: env.AWC_NOTIFICATION_MODE,
    enabled: env.AWC_NOTIFICATION_ENABLED,
  });
  if (mode === "off") {
    await log("debug", "Notification controller disabled.", { mode });
    return {
      enabled: false,
      mode,
      stop() {},
      refresh: async () => false,
      controller: null,
    };
  }

  const observedNotifier = notifier?.notify
    ? {
      notify: async (notification) => {
        await log("info", "Notification selected.", {
          type: notification.type,
          from: notification.from,
          to: notification.to,
        });
        return notifier.notify(notification);
      },
    }
    : notifier;

  const controller = createHealthRefreshController({
    read,
    requestRender: () => {},
    notifier: observedNotifier,
    notificationMode: mode,
    notificationEnabled: env.AWC_NOTIFICATION_ENABLED,
    notificationCooldownMs,
    notificationStore,
    now,
    setIntervalFn,
    clearIntervalFn,
    pollIntervalMs,
    staleAfterMs,
    throttleMs,
  });
  await controller.refresh({ force: true });
  controller.start();
  await log("debug", "Notification controller started.", { mode });
  return {
    enabled: true,
    mode,
    stop: () => controller.stop(),
    refresh: (options) => controller.refresh(options),
    controller,
  };
}

export async function startSharedPluginNotificationController(options = {}) {
  const mode = resolveNotificationMode({
    mode: options.env?.AWC_NOTIFICATION_MODE ?? process.env.AWC_NOTIFICATION_MODE,
    enabled: options.env?.AWC_NOTIFICATION_ENABLED ?? process.env.AWC_NOTIFICATION_ENABLED,
  });
  const slot = sharedPluginNotificationRuntimeSlot();
  const activeRuntime = slot.runtime ?? activePluginNotificationRuntime;

  if (activeRuntime && activeRuntime.mode === mode) {
    await options.log?.("debug", "Notification controller already active.", { mode });
    activePluginNotificationRuntime = activeRuntime;
    return activeRuntime;
  }

  const lock = options.lock ?? (options.useLock ? acquirePluginNotificationLock({
    env: options.env ?? process.env,
    now: options.now,
  }) : { acquired: true, release() {} });
  if (!lock.acquired) {
    await options.log?.("debug", "Notification controller already active in another plugin context.", {
      mode,
      ownerPid: lock.ownerPid ?? null,
    });
    return {
      enabled: false,
      mode,
      stop() {},
      refresh: async () => false,
      controller: null,
      lock,
    };
  }

  activeRuntime?.stop?.();
  const runtime = await startPluginNotificationController(options);
  const cleanup = () => {
    runtime.stop();
    lock.release?.();
    if (activePluginNotificationRuntime === runtime) activePluginNotificationRuntime = null;
    if (activePluginNotificationCleanup === cleanup) activePluginNotificationCleanup = null;
    if (slot.runtime === runtime) slot.runtime = null;
    if (slot.cleanup === cleanup) slot.cleanup = null;
  };
  activePluginNotificationRuntime = runtime;
  activePluginNotificationCleanup = cleanup;
  slot.runtime = runtime;
  slot.cleanup = cleanup;
  runtime.lock = lock;
  return runtime;
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

export const AgentCompanionPlugin = async ({ client, directory }) => {
  async function log(level, message, extra = {}) {
    if (!client?.app?.log) return;
    await client.app.log({
      body: {
        service: "ai-worker-companion",
        level,
        message,
        extra,
      },
    });
  }

  await log("info", "AI Worker Companion OpenCode plugin initialized");
  const notificationRuntime = await startSharedPluginNotificationController({
    directory,
    log,
    useLock: true,
  }).catch(async (error) => {
    await log("warn", "Notification controller failed to start.", {
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      enabled: false,
      mode: "off",
      stop() {},
      refresh: async () => false,
      controller: null,
    };
  });
  return {
    event: async ({ event }) => {
      if (!event?.type) return;
      if (notificationRuntime.enabled && HEALTH_REFRESH_EVENTS.has(event.type)) {
        await notificationRuntime.refresh().catch(() => {});
      }

      if (event.type === "session.idle") {
        await log("debug", "Session idle observed.", {
          eventType: event.type,
        });
      }

      if (event.type === "session.error") {
        await log("warn", "Session error observed.", {
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
    // Notifications are owned by AgentCompanionPlugin, which is loaded through
    // OpenCode's standard plugin lifecycle. Keeping TUI notification-free avoids
    // duplicate OS notifications when both plugin surfaces are active.
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
