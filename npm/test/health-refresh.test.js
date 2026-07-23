import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acquirePluginNotificationLock,
  checkForUpdate,
  compareVersions,
  createHealthRefreshController,
  createNotificationStore,
  executeWatcher,
  registerHealthEventHandlers,
  replaceActivePluginNotificationCleanup,
  replaceActiveTuiCleanup,
  resolveNotificationMode,
  startPluginNotificationController,
  startSharedPluginNotificationController,
  updateAvailableMessage,
} from "../../integrations/opencode/.opencode/plugins/agent-companion.js";

function healthState({ health = "idle", checkedAtMs, lastUpdate = "9:36 PM", sessionId = "ses_test", providerRetryActive = false } = {}) {
  const status = health[0].toUpperCase() + health.slice(1);
  return {
    health,
    status,
    reason: health === "idle" ? "No tool has run in the selected session yet." : health,
    currentState: health,
    lastUpdate,
    sessionId,
    sessionTitle: "Test session",
    providerRetry: { active: providerRetryActive },
    refreshSucceeded: true,
    checkedAtMs,
  };
}

function scheduler() {
  let callback = null;
  return {
    setIntervalFn(fn) {
      callback = fn;
      return { unref() {} };
    },
    clearIntervalFn() {
      callback = null;
    },
    tick() {
      assert.ok(callback, "polling callback should remain scheduled");
      return callback();
    },
    isScheduled() {
      return callback !== null;
    },
  };
}

function updateCache(initial = null) {
  let value = initial;
  let writes = 0;
  return {
    readCache: () => value,
    writeCache: (_path, nextValue) => {
      writes += 1;
      value = nextValue;
    },
    get value() {
      return value;
    },
    get writes() {
      return writes;
    },
  };
}

function registryResponse(version) {
  return {
    ok: true,
    json: async () => ({ version }),
  };
}

test("version comparison follows semver precedence", () => {
  assert.equal(compareVersions("1.0.0-beta", "1.0.0"), -1);
  assert.equal(compareVersions("1.0.0-rc.1", "1.0.0"), -1);
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("0.2.9", "0.2.10"), -1);
  assert.equal(compareVersions("0.10.0", "0.9.9"), 1);
  assert.equal(compareVersions("1.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.0.0-rc.2", "1.0.0-rc.1"), 1);
});

test("update checker reports no update when latest is current", async () => {
  const cache = updateCache();
  const result = await checkForUpdate({
    currentVersion: "0.2.6",
    now: () => 1_000,
    fetchFn: async () => registryResponse("0.2.6"),
    readCache: cache.readCache,
    writeCache: cache.writeCache,
  });

  assert.equal(result.updateAvailable, false);
  assert.equal(result.latestVersion, "0.2.6");
  assert.equal(cache.writes, 1);
});

test("update checker reports update when latest is newer", async () => {
  const cache = updateCache();
  const result = await checkForUpdate({
    currentVersion: "0.2.6",
    now: () => 1_000,
    fetchFn: async () => registryResponse("0.2.7"),
    readCache: cache.readCache,
    writeCache: cache.writeCache,
  });

  assert.equal(result.updateAvailable, true);
  assert.equal(result.currentVersion, "0.2.6");
  assert.equal(result.latestVersion, "0.2.7");
});

test("update checker ignores registry timeout", async () => {
  const cache = updateCache();
  const result = await checkForUpdate({
    currentVersion: "0.2.6",
    timeoutMs: 1,
    now: () => 1_000,
    fetchFn: (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")));
      setTimeout(() => resolve(registryResponse("0.2.7")), 50);
    }),
    readCache: cache.readCache,
    writeCache: cache.writeCache,
  });

  assert.equal(result.updateAvailable, false);
  assert.equal(result.skipped, "registry_failure");
  assert.equal(cache.writes, 0);
});

test("update checker ignores registry failure", async () => {
  const cache = updateCache();
  const result = await checkForUpdate({
    currentVersion: "0.2.6",
    now: () => 1_000,
    fetchFn: async () => ({ ok: false, json: async () => ({}) }),
    readCache: cache.readCache,
    writeCache: cache.writeCache,
  });

  assert.equal(result.updateAvailable, false);
  assert.equal(result.skipped, "registry_failure");
  assert.equal(cache.writes, 0);
});

test("update checker ignores offline errors", async () => {
  const cache = updateCache();
  const result = await checkForUpdate({
    currentVersion: "0.2.6",
    now: () => 1_000,
    fetchFn: async () => { throw new Error("offline"); },
    readCache: cache.readCache,
    writeCache: cache.writeCache,
  });

  assert.equal(result.updateAvailable, false);
  assert.equal(result.skipped, "registry_failure");
  assert.equal(cache.writes, 0);
});

test("update checker retries after offline failure because failure is not cached", async () => {
  let fetches = 0;
  const cache = updateCache();
  const first = await checkForUpdate({
    currentVersion: "0.2.6",
    now: () => 1_000,
    fetchFn: async () => {
      fetches += 1;
      throw new Error("offline");
    },
    readCache: cache.readCache,
    writeCache: cache.writeCache,
  });

  const second = await checkForUpdate({
    currentVersion: "0.2.6",
    now: () => 2_000,
    fetchFn: async () => {
      fetches += 1;
      return registryResponse("0.2.7");
    },
    readCache: cache.readCache,
    writeCache: cache.writeCache,
  });

  assert.equal(first.updateAvailable, false);
  assert.equal(first.skipped, "registry_failure");
  assert.equal(second.updateAvailable, true);
  assert.equal(second.latestVersion, "0.2.7");
  assert.equal(fetches, 2);
  assert.equal(cache.writes, 1);
});

test("update available message tells users to restart OpenCode", () => {
  const message = updateAvailableMessage({
    currentVersion: "0.2.6",
    latestVersion: "0.2.7",
  });

  assert.match(message, /Current : 0\.2\.6/);
  assert.match(message, /Latest  : 0\.2\.7/);
  assert.match(message, /npx ai-worker-companion@latest install/);
  assert.match(message, /Then restart OpenCode\./);
});

test("update checker ignores cache write failures", async () => {
  const result = await checkForUpdate({
    currentVersion: "0.2.6",
    now: () => 1_000,
    fetchFn: async () => registryResponse("0.2.7"),
    readCache: () => null,
    writeCache: () => { throw new Error("cache denied"); },
  });

  assert.equal(result.updateAvailable, true);
  assert.equal(result.latestVersion, "0.2.7");
});

test("update checker uses cache hit", async () => {
  let fetches = 0;
  const cache = updateCache({
    updateAvailable: true,
    currentVersion: "0.2.6",
    latestVersion: "0.2.7",
    checkedAtMs: 1_000,
  });

  const result = await checkForUpdate({
    currentVersion: "0.2.6",
    now: () => 2_000,
    intervalMs: 24 * 60 * 60 * 1000,
    fetchFn: async () => {
      fetches += 1;
      return registryResponse("0.2.8");
    },
    readCache: cache.readCache,
    writeCache: cache.writeCache,
  });

  assert.equal(result.updateAvailable, true);
  assert.equal(result.latestVersion, "0.2.7");
  assert.equal(result.fromCache, true);
  assert.equal(fetches, 0);
});

test("update checker does not requery within 24 hours after no update", async () => {
  let fetches = 0;
  const cache = updateCache({
    updateAvailable: false,
    currentVersion: "0.2.6",
    latestVersion: "0.2.6",
    checkedAtMs: 1_000,
  });

  const result = await checkForUpdate({
    currentVersion: "0.2.6",
    now: () => 1_000 + 60 * 60 * 1000,
    intervalMs: 24 * 60 * 60 * 1000,
    fetchFn: async () => {
      fetches += 1;
      return registryResponse("0.2.7");
    },
    readCache: cache.readCache,
    writeCache: cache.writeCache,
  });

  assert.equal(result.updateAvailable, false);
  assert.equal(result.fromCache, true);
  assert.equal(fetches, 0);
});

test("polling continues across multiple cycles", async () => {
  let now = 1_000;
  let reads = 0;
  let renders = 0;
  const clock = scheduler();
  const controller = createHealthRefreshController({
    read: () => {
      reads += 1;
      return healthState({ checkedAtMs: now, lastUpdate: String(now) });
    },
    requestRender: () => { renders += 1; },
    now: () => now,
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
    pollIntervalMs: 10,
    staleAfterMs: 100,
  });
  await controller.refresh({ force: true });

  controller.start();
  for (const value of [1_010, 1_020, 1_030]) {
    now = value;
    await clock.tick();
  }

  assert.equal(renders, 3);
  assert.equal(reads, 4);
  assert.equal(controller.getState().lastUpdate, "1030");
  controller.stop();
});

test("a transient refresh error recovers on the next polling cycle", async () => {
  let now = 1_000;
  let call = 0;
  const clock = scheduler();
  const controller = createHealthRefreshController({
    read: () => {
      call += 1;
      if (call === 2) throw new Error("temporary DB read failure");
      return healthState({ health: call === 1 ? "idle" : "active", checkedAtMs: now });
    },
    now: () => now,
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
    staleAfterMs: 100,
  });
  await controller.refresh({ force: true });

  controller.start();
  now = 1_010;
  await clock.tick();
  assert.equal(controller.getState().status, "Idle");
  now = 1_020;
  await clock.tick();
  assert.equal(controller.getState().status, "Active");
  controller.stop();
});

test("an old successful status is rendered as Unknown without changing Last Update", async () => {
  let now = 20_000;
  const controller = createHealthRefreshController({
    read: () => healthState({ checkedAtMs: 1_000, lastUpdate: "9:36 PM" }),
    now: () => now,
    staleAfterMs: 10_000,
  });
  await controller.refresh({ force: true });

  assert.deepEqual(
    {
      status: controller.getState().status,
      reason: controller.getState().reason,
      lastUpdate: controller.getState().lastUpdate,
    },
    { status: "Unknown", reason: "Health data is stale.", lastUpdate: "9:36 PM" },
  );
});

test("a fresh Idle status remains Idle", async () => {
  let now = 5_000;
  const controller = createHealthRefreshController({
    read: () => healthState({ checkedAtMs: 1_000 }),
    now: () => now,
    staleAfterMs: 10_000,
  });
  await controller.refresh({ force: true });

  assert.equal(controller.getState().status, "Idle");
  assert.equal(controller.getState().reason, "No tool has run in the selected session yet.");
});

test("single-flight skips ticks while a watcher refresh is still running", async () => {
  let release;
  let reads = 0;
  const pending = new Promise((resolve) => { release = resolve; });
  const controller = createHealthRefreshController({
    read: async () => {
      reads += 1;
      await pending;
      return healthState({ checkedAtMs: 1_000 });
    },
    now: () => 1_000,
  });

  const first = controller.refresh({ force: true });
  assert.equal(controller.isRefreshing(), true);
  assert.equal(await controller.refresh({ force: true }), false);
  assert.equal(reads, 1);
  release();
  assert.equal(await first, true);
  assert.equal(controller.isRefreshing(), false);
});

test("single-flight lock is released after a watcher failure", async () => {
  let reads = 0;
  const controller = createHealthRefreshController({
    read: async () => {
      reads += 1;
      if (reads === 1) throw new Error("watcher failed");
      return healthState({ health: "active", checkedAtMs: 2_000 });
    },
    now: () => 2_000,
  });

  assert.equal(await controller.refresh({ force: true }), false);
  assert.equal(controller.isRefreshing(), false);
  assert.equal(await controller.refresh({ force: true }), true);
  assert.equal(controller.getState().status, "Active");
});

test("stop clears the timer and aborts an in-flight watcher", async () => {
  const clock = scheduler();
  let aborted = false;
  const controller = createHealthRefreshController({
    read: ({ signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        aborted = true;
        reject(new Error("aborted"));
      });
    }),
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
  });

  controller.start();
  const refresh = controller.refresh({ force: true });
  controller.stop();
  await refresh;
  assert.equal(aborted, true);
  assert.equal(controller.isRefreshing(), false);
  assert.equal(clock.isScheduled(), false);
  assert.equal(await controller.refresh({ force: true }), false);
});

test("starting the same controller twice creates only one timer", () => {
  let schedules = 0;
  const controller = createHealthRefreshController({
    read: async () => healthState({ checkedAtMs: 1_000 }),
    setIntervalFn: () => {
      schedules += 1;
      return { unref() {} };
    },
  });

  controller.start();
  controller.start();
  assert.equal(schedules, 1);
  controller.stop();
});

test("polling refreshes even when rendering throws", async () => {
  let reads = 0;
  const clock = scheduler();
  const controller = createHealthRefreshController({
    read: async () => {
      reads += 1;
      return healthState({ checkedAtMs: reads * 1_000 });
    },
    requestRender: () => { throw new Error("renderer unavailable"); },
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
  });

  await controller.refresh({ force: true });
  controller.start();
  await clock.tick();
  await clock.tick();
  assert.equal(reads, 3);
  controller.stop();
});

test("initial Idle does not send a notification", async () => {
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => healthState({ health: "idle", checkedAtMs: 1_000 }),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationEnabled: true,
    now: () => 1_000,
  });

  await controller.refresh({ force: true });
  assert.equal(notifications.length, 0);
});

test("notification mode defaults to off without explicit opt-in", async () => {
  assert.equal(resolveNotificationMode(), "off");
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000 }),
    healthState({ health: "idle", checkedAtMs: 2_000 }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 0);
});

test("notification mode off prevents notifier calls", async () => {
  assert.equal(resolveNotificationMode({ mode: "off", enabled: "1" }), "off");
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000 }),
    healthState({ health: "stuck", checkedAtMs: 2_000 }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationMode: "off",
    notificationEnabled: true,
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 0);
});

test("problems-only mode does not send completion notifications", async () => {
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000 }),
    healthState({ health: "idle", checkedAtMs: 2_000 }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationMode: "problems-only",
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 0);
});

test("problems-only mode sends Stuck notifications", async () => {
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000 }),
    healthState({ health: "stuck", checkedAtMs: 2_000 }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationMode: "problems-only",
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, "attention");
});

test("problems-only mode sends provider retry notifications", async () => {
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000 }),
    healthState({ health: "stuck", checkedAtMs: 2_000, providerRetryActive: true }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationMode: "problems-only",
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, "provider_retry");
});

test("problems-only mode sends Failed notifications", async () => {
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000 }),
    healthState({ health: "failed", checkedAtMs: 2_000 }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationMode: "problems-only",
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, "failed");
});

test("all mode sends completion notifications", async () => {
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000 }),
    healthState({ health: "idle", checkedAtMs: 2_000 }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationMode: "all",
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, "completed");
});

test("legacy notification enabled without mode preserves all notifications", async () => {
  assert.equal(resolveNotificationMode({ enabled: "1" }), "all");
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000 }),
    healthState({ health: "idle", checkedAtMs: 2_000 }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationEnabled: true,
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, "completed");
});

test("notification mode takes precedence over legacy enabled flag", async () => {
  assert.equal(resolveNotificationMode({ mode: "problems-only", enabled: "1" }), "problems-only");
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000 }),
    healthState({ health: "idle", checkedAtMs: 2_000 }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationEnabled: true,
    notificationMode: "problems-only",
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 0);
});

test("invalid notification mode safely disables notifications", async () => {
  assert.equal(resolveNotificationMode({ mode: "loud", enabled: "1" }), "off");
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000 }),
    healthState({ health: "failed", checkedAtMs: 2_000 }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationMode: "loud",
    notificationEnabled: true,
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 0);
});

test("Active to Idle sends one completed notification", async () => {
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000 }),
    healthState({ health: "idle", checkedAtMs: 2_000 }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationEnabled: true,
    now: () => 2_000,
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, "completed");
  assert.equal(notifications[0].title, "AWC — 작업 완료");
});

test("Quiet to Idle sends a completed notification", async () => {
  const states = [
    healthState({ health: "quiet", checkedAtMs: 1_000 }),
    healthState({ health: "idle", checkedAtMs: 2_000 }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationEnabled: true,
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, "completed");
});

test("Active to Stuck sends an attention notification", async () => {
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000 }),
    healthState({ health: "stuck", checkedAtMs: 2_000 }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationEnabled: true,
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, "attention");
});

test("provider retry Stuck sends a provider retry notification", async () => {
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000 }),
    healthState({ health: "stuck", checkedAtMs: 2_000, providerRetryActive: true }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationEnabled: true,
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, "provider_retry");
  assert.equal(notifications[0].title, "AWC — Provider retry");
});

test("Stuck to Stuck does not repeat a notification", async () => {
  const states = [
    healthState({ health: "stuck", checkedAtMs: 1_000 }),
    healthState({ health: "stuck", checkedAtMs: 2_000 }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationEnabled: true,
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 0);
});

test("Unknown to Idle does not send a notification", async () => {
  const states = [
    healthState({ health: "unknown", checkedAtMs: 1_000 }),
    healthState({ health: "idle", checkedAtMs: 2_000 }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationEnabled: true,
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 0);
});

test("different sessions are not compared for completion notifications", async () => {
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000, sessionId: "ses_a" }),
    healthState({ health: "idle", checkedAtMs: 2_000, sessionId: "ses_b" }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationEnabled: true,
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 0);
});

test("same transition notification is suppressed during cooldown", async () => {
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000 }),
    healthState({ health: "idle", checkedAtMs: 2_000 }),
    healthState({ health: "active", checkedAtMs: 3_000 }),
    healthState({ health: "idle", checkedAtMs: 4_000 }),
  ];
  const notifications = [];
  let now = 1_000;
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationEnabled: true,
    notificationCooldownMs: 30_000,
    now: () => now,
  });

  for (const value of [1_000, 2_000, 3_000, 4_000]) {
    now = value;
    await controller.refresh({ force: true });
  }
  assert.equal(notifications.length, 1);
});

test("shared notification store suppresses duplicate notifications across controllers", async () => {
  const notificationStore = createNotificationStore();
  const notifications = [];
  const makeController = () => {
    const states = [
      healthState({ health: "active", checkedAtMs: 1_000 }),
      healthState({ health: "idle", checkedAtMs: 2_000 }),
    ];
    return createHealthRefreshController({
      read: async () => states.shift(),
      notifier: { notify: async (event) => notifications.push(event) },
      notificationMode: "all",
      notificationCooldownMs: 30_000,
      notificationStore,
      now: () => 2_000,
    });
  };

  const first = makeController();
  const second = makeController();
  await first.refresh({ force: true });
  await second.refresh({ force: true });
  await first.refresh({ force: true });
  await second.refresh({ force: true });

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, "completed");
});

test("plugin notification runtime stays disabled when mode is off", async () => {
  let reads = 0;
  const logs = [];
  const runtime = await startPluginNotificationController({
    env: { AWC_NOTIFICATION_MODE: "off" },
    read: async () => {
      reads += 1;
      return healthState({ health: "active", checkedAtMs: 1_000 });
    },
    log: async (level, message, extra) => logs.push({ level, message, extra }),
  });

  assert.equal(runtime.enabled, false);
  assert.equal(runtime.mode, "off");
  assert.equal(reads, 0);
  assert.equal(logs[0].message, "Notification controller disabled.");
});

test("plugin notification runtime sends completion notifications from polling", async () => {
  const clock = scheduler();
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000 }),
    healthState({ health: "idle", checkedAtMs: 2_000 }),
  ];
  const notifications = [];
  const runtime = await startPluginNotificationController({
    env: { AWC_NOTIFICATION_MODE: "all" },
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
    notificationStore: createNotificationStore(),
    now: () => 2_000,
  });

  assert.equal(runtime.enabled, true);
  assert.equal(notifications.length, 0);
  await clock.tick();
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, "completed");
  runtime.stop();
  assert.equal(clock.isScheduled(), false);
});

test("shared plugin notification runtime is reused across plugin instances", async () => {
  replaceActivePluginNotificationCleanup(null);
  const clock = scheduler();
  let reads = 0;
  const logs = [];

  const first = await startSharedPluginNotificationController({
    env: { AWC_NOTIFICATION_MODE: "all" },
    read: async () => {
      reads += 1;
      return healthState({ health: "active", checkedAtMs: 1_000 });
    },
    notifier: { notify: async () => {} },
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
    notificationStore: createNotificationStore(),
    log: async (level, message, extra) => logs.push({ level, message, extra }),
  });

  const second = await startSharedPluginNotificationController({
    env: { AWC_NOTIFICATION_MODE: "all" },
    read: async () => {
      throw new Error("second runtime should not start");
    },
    notifier: { notify: async () => {} },
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
    log: async (level, message, extra) => logs.push({ level, message, extra }),
  });

  assert.equal(first, second);
  assert.equal(reads, 1);
  assert.equal(logs.at(-1).message, "Notification controller already active.");
  assert.equal(clock.isScheduled(), true);
  replaceActivePluginNotificationCleanup(null);
  assert.equal(clock.isScheduled(), false);
});

test("shared plugin notification runtime restarts when mode changes", async () => {
  replaceActivePluginNotificationCleanup(null);
  const firstClock = scheduler();
  const secondClock = scheduler();

  const first = await startSharedPluginNotificationController({
    env: { AWC_NOTIFICATION_MODE: "problems-only" },
    read: async () => healthState({ health: "active", checkedAtMs: 1_000 }),
    notifier: { notify: async () => {} },
    setIntervalFn: firstClock.setIntervalFn,
    clearIntervalFn: firstClock.clearIntervalFn,
    notificationStore: createNotificationStore(),
  });
  const second = await startSharedPluginNotificationController({
    env: { AWC_NOTIFICATION_MODE: "all" },
    read: async () => healthState({ health: "active", checkedAtMs: 2_000 }),
    notifier: { notify: async () => {} },
    setIntervalFn: secondClock.setIntervalFn,
    clearIntervalFn: secondClock.clearIntervalFn,
    notificationStore: createNotificationStore(),
  });

  assert.notEqual(first, second);
  assert.equal(firstClock.isScheduled(), false);
  assert.equal(secondClock.isScheduled(), true);
  replaceActivePluginNotificationCleanup(null);
});

test("plugin notification lock allows only one active owner", () => {
  const dir = mkdtempSync(join(tmpdir(), "awc-lock-test-"));
  const env = { AWC_NOTIFICATION_LOCK_PATH: join(dir, "notification.lock") };
  const first = acquirePluginNotificationLock({ env, pid: process.pid, now: () => 1_000 });
  const second = acquirePluginNotificationLock({ env, pid: process.pid, now: () => 2_000 });

  assert.equal(first.acquired, true);
  assert.equal(second.acquired, false);
  assert.equal(second.ownerPid, process.pid);
  first.release();
  const third = acquirePluginNotificationLock({ env, pid: process.pid, now: () => 3_000 });
  assert.equal(third.acquired, true);
  third.release();
});

test("shared plugin notification runtime skips when another context owns the lock", async () => {
  replaceActivePluginNotificationCleanup(null);
  const dir = mkdtempSync(join(tmpdir(), "awc-runtime-lock-test-"));
  const env = {
    AWC_NOTIFICATION_MODE: "all",
    AWC_NOTIFICATION_LOCK_PATH: join(dir, "notification.lock"),
  };
  const lock = acquirePluginNotificationLock({ env, pid: process.pid, now: () => 1_000 });
  let reads = 0;
  const runtime = await startSharedPluginNotificationController({
    env,
    useLock: true,
    now: () => 2_000,
    read: async () => {
      reads += 1;
      return healthState({ health: "active", checkedAtMs: 1_000 });
    },
    notifier: { notify: async () => {} },
  });

  assert.equal(runtime.enabled, false);
  assert.equal(reads, 0);
  lock.release();
});

test("notifier failure does not break refresh", async () => {
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000 }),
    healthState({ health: "idle", checkedAtMs: 2_000 }),
  ];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async () => { throw new Error("notification failed"); } },
    notificationEnabled: true,
    now: () => 2_000,
  });

  await controller.refresh({ force: true });
  assert.equal(await controller.refresh({ force: true }), true);
  assert.equal(controller.getState().status, "Idle");
});

test("notification disabled prevents notifier calls", async () => {
  const states = [
    healthState({ health: "active", checkedAtMs: 1_000 }),
    healthState({ health: "idle", checkedAtMs: 2_000 }),
  ];
  const notifications = [];
  const controller = createHealthRefreshController({
    read: async () => states.shift(),
    notifier: { notify: async (event) => notifications.push(event) },
    notificationEnabled: false,
  });

  await controller.refresh({ force: true });
  await controller.refresh({ force: true });
  assert.equal(notifications.length, 0);
});

test("replacing a TUI runtime disposes the previous runtime", () => {
  let firstDisposed = 0;
  let secondDisposed = 0;
  replaceActiveTuiCleanup(() => { firstDisposed += 1; });
  replaceActiveTuiCleanup(() => { secondDisposed += 1; });
  assert.equal(firstDisposed, 1);
  assert.equal(secondDisposed, 0);
  replaceActiveTuiCleanup(null);
  assert.equal(secondDisposed, 1);
});

test("OpenCode event handlers use event.on and all unsubscribe on cleanup", async () => {
  const handlers = new Map();
  let removals = 0;
  let refreshes = 0;
  let renders = 0;
  const eventBus = {
    on(type, handler) {
      handlers.set(type, handler);
      return () => {
        handlers.delete(type);
        removals += 1;
      };
    },
  };
  const controller = { refresh: async () => { refreshes += 1; return true; } };
  const removeHandlers = registerHealthEventHandlers(eventBus, controller, () => { renders += 1; });

  assert.ok(handlers.has("session.status"));
  await handlers.get("session.status")();
  assert.equal(refreshes, 1);
  assert.equal(renders, 1);
  for (const remove of removeHandlers) remove();
  assert.equal(handlers.size, 0);
  assert.equal(removals, removeHandlers.length);
});

test("aborting an actual watcher child rejects the execution", async () => {
  const abortController = new AbortController();
  const watcher = executeWatcher(
    process.execPath,
    ["-e", "setInterval(() => {}, 1000)"],
    { signal: abortController.signal, timeout: 10_000 },
  );
  abortController.abort();
  await assert.rejects(watcher, (error) => error?.name === "AbortError" || error?.code === "ABORT_ERR");
});
