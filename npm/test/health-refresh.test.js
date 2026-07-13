import test from "node:test";
import assert from "node:assert/strict";
import {
  createHealthRefreshController,
  executeWatcher,
  registerHealthEventHandlers,
  replaceActiveTuiCleanup,
} from "../../integrations/opencode/.opencode/plugins/agent-companion.js";

function healthState({ health = "idle", checkedAtMs, lastUpdate = "9:36 PM" } = {}) {
  const status = health[0].toUpperCase() + health.slice(1);
  return {
    health,
    status,
    reason: health === "idle" ? "No tool has run in the selected session yet." : health,
    currentState: health,
    lastUpdate,
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
