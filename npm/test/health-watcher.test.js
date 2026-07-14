import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const watcher = fileURLToPath(new URL("../../integrations/opencode/adapter/db_health_watcher.ts", import.meta.url));
const nowMs = 1_800_000_000_000;

function toolPart({ tool = "read", status = "completed", exit, error, at = 0, startedAgo = 0 } = {}) {
  return {
    at,
    data: {
      type: "tool",
      tool,
      state: {
        status,
        time: { start: nowMs + at * 1000 - startedAgo * 1000, ...(status === "completed" ? { end: nowMs + at * 1000 } : {}) },
        metadata: exit === undefined ? {} : { exit },
        ...(error === undefined ? {} : { error }),
      },
    },
  };
}

function stepStart({ at = 0 } = {}) {
  return { at, data: { type: "step-start", snapshot: `snapshot-${at}` } };
}

function stepFinish({ at = 0, reason = "stop" } = {}) {
  return { at, data: { type: "step-finish", reason, snapshot: `snapshot-${at}` } };
}

function textPart({ at = 0, text = "done" } = {}) {
  return { at, data: { type: "text", text } };
}

async function assess({
  tool = "read",
  status = "completed",
  exit,
  error,
  startedAgo = 0,
  parts,
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), "awc-health-"));
  const dbPath = join(directory, "opencode.db");
  const db = new DatabaseSync(dbPath);
  db.exec("create table session (id text, title text, directory text, time_created integer, time_updated integer)");
  db.exec("create table part (id text, session_id text, time_created integer, time_updated integer, data text)");
  db.prepare("insert into session values (?, ?, ?, ?, ?)").run("ses_test", "test", directory, nowMs, nowMs);
  const timeline = parts ?? [toolPart({ tool, status, exit, error, startedAgo })];
  const insert = db.prepare("insert into part values (?, ?, ?, ?, ?)");
  timeline.forEach((part, index) => {
    const time = nowMs + part.at * 1000;
    insert.run(`prt_${index}`, "ses_test", time, time, JSON.stringify(part.data));
  });
  db.close();

  const completed = spawnSync(process.execPath, [
    watcher,
    "--db", dbPath,
    "--session", "latest",
    "--quiet-threshold", "60",
    "--stuck-threshold", "180",
    "--now-ms", String(nowMs),
    "--once",
  ], { encoding: "utf8" });
  const output = JSON.parse(completed.stdout);
  return { ...output, exitCode: completed.status };
}

test("completed non-shell tools without exit codes are idle", async () => {
  for (const tool of ["read", "webfetch"]) {
    const output = await assess({ tool });
    assert.equal(output.health, "idle");
    assert.equal(output.exitCode, 0);
  }
});

test("completed non-shell tools with explicit errors are failed", async () => {
  const output = await assess({ tool: "read", error: "read failed" });
  assert.equal(output.health, "failed");
});

test("completed shell tools preserve exit-code semantics", async () => {
  assert.equal((await assess({ tool: "bash", exit: 0 })).health, "idle");
  assert.equal((await assess({ tool: "bash", exit: 1 })).health, "failed");
  const missing = await assess({ tool: "bash" });
  assert.equal(missing.health, "unknown");
  assert.equal(missing.exitCode, 1);
});

test("running tools preserve active quiet and stuck thresholds", async () => {
  assert.equal((await assess({ status: "running", startedAgo: 30 })).health, "active");
  assert.equal((await assess({ status: "running", startedAgo: 90 })).health, "quiet");
  assert.equal((await assess({ status: "running", startedAgo: 240 })).health, "stuck");
});

test("latest_tool_completed_but_newer_step_error is failed", async () => {
  const output = await assess({
    parts: [
      toolPart({ tool: "write", status: "completed", at: -120 }),
      stepStart({ at: -60 }),
      stepFinish({ at: -30, reason: "error" }),
    ],
  });
  assert.equal(output.health, "failed");
  assert.equal(output.reason, "Latest session step finished with error.");
  assert.equal(output.activity.latest_activity_type, "step-finish");
  assert.equal(output.activity.latest_step_reason, "error");
});

test("latest_tool_completed_but_newer_step_stop stays idle with session evidence", async () => {
  const output = await assess({
    parts: [
      toolPart({ tool: "write", status: "completed", at: -120 }),
      stepStart({ at: -60 }),
      stepFinish({ at: -30, reason: "stop" }),
    ],
  });
  assert.equal(output.health, "idle");
  assert.equal(output.reason, "Latest session step completed; no active tool is running.");
  assert.equal(output.activity.latest_activity_type, "step-finish");
  assert.equal(output.activity.latest_tool_at, Math.trunc((nowMs - 120_000) / 1000));
});

test("completed_tool_is_not_latest_activity uses session activity reason", async () => {
  const output = await assess({
    parts: [
      toolPart({ tool: "write", status: "completed", at: -120 }),
      textPart({ at: -10, text: "later assistant response" }),
    ],
  });
  assert.equal(output.health, "idle");
  assert.equal(output.reason, "Latest session activity completed; no active tool is running.");
  assert.equal(output.activity.latest_activity_type, "text");
});

test("step_start_without_finish_before_quiet_threshold is active", async () => {
  const output = await assess({ parts: [stepStart({ at: -30 })] });
  assert.equal(output.health, "active");
  assert.match(output.reason, /Session step is active for 30s/);
});

test("step_start_without_finish_over_quiet_threshold is quiet", async () => {
  const output = await assess({ parts: [stepStart({ at: -90 })] });
  assert.equal(output.health, "quiet");
  assert.match(output.reason, /below stuck threshold/);
});

test("step_start_without_finish_over_stuck_threshold is stuck", async () => {
  const output = await assess({ parts: [stepStart({ at: -240 })] });
  assert.equal(output.health, "stuck");
  assert.match(output.reason, /exceeding stuck threshold/);
});

test("running_tool_still_has_priority_over_older_step", async () => {
  const output = await assess({
    parts: [
      stepStart({ at: -120 }),
      stepFinish({ at: -90, reason: "error" }),
      toolPart({ tool: "bash", status: "running", at: -10, startedAgo: 10 }),
    ],
  });
  assert.equal(output.health, "active");
  assert.match(output.reason, /Tool is running/);
});
