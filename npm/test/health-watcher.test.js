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

async function assess({ tool = "read", status = "completed", exit, error, startedAgo = 0 }) {
  const directory = await mkdtemp(join(tmpdir(), "awc-health-"));
  const dbPath = join(directory, "opencode.db");
  const db = new DatabaseSync(dbPath);
  db.exec("create table session (id text, title text, directory text, time_created integer, time_updated integer)");
  db.exec("create table part (id text, session_id text, time_created integer, time_updated integer, data text)");
  db.prepare("insert into session values (?, ?, ?, ?, ?)").run("ses_test", "test", directory, nowMs, nowMs);
  const state = {
    status,
    time: { start: nowMs - startedAgo * 1000, ...(status === "completed" ? { end: nowMs } : {}) },
    metadata: exit === undefined ? {} : { exit },
    ...(error === undefined ? {} : { error }),
  };
  db.prepare("insert into part values (?, ?, ?, ?, ?)").run(
    "prt_test",
    "ses_test",
    nowMs,
    nowMs,
    JSON.stringify({ type: "tool", tool, state }),
  );
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
