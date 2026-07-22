import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
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

function timestampAt(at) {
  const date = new Date(nowMs + at * 1000);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function retryLine({
  at = -10,
  session = "ses_test",
  provider = "google",
  model = "gemini-2.5-flash",
  statusCode = 429,
  status = "RESOURCE_EXHAUSTED",
  retryDelay = 31,
  retryable = true,
} = {}) {
  const sessionField = session ? ` session.id=${session}` : "";
  const retryInfo = retryDelay == null ? "" : `,{\\"@type\\":\\"type.googleapis.com/google.rpc.RetryInfo\\",\\"retryDelay\\":\\"${retryDelay}s\\"}`;
  return `ERROR ${timestampAt(at)} +100ms service=llm providerID=${provider} modelID=${model}${sessionField} error={"error":{"name":"AI_APICallError","statusCode":${statusCode},"responseBody":"{\\"error\\":{\\"code\\":${statusCode},\\"status\\":\\"${status}\\",\\"details\\":[{\\"@type\\":\\"type.googleapis.com/google.rpc.Help\\"}${retryInfo}]}}","isRetryable":${retryable},"data":{"error":{"code":${statusCode},"status":"${status}"}}}} stream error`;
}

async function assess({
  tool = "read",
  status = "completed",
  exit,
  error,
  startedAgo = 0,
  parts,
  sessions,
  retryLines = [],
  retryCursor,
  retryLogDir,
  disableProviderRetry = false,
  session = "latest",
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), "awc-health-"));
  const dbPath = join(directory, "opencode.db");
  const db = new DatabaseSync(dbPath);
  db.exec("create table session (id text, parent_id text, title text, directory text, agent text, model text, time_created integer, time_updated integer, time_archived integer)");
  db.exec("create table part (id text, session_id text, time_created integer, time_updated integer, data text)");
  const sessionRows = sessions ?? [{
    id: "ses_test",
    parent_id: null,
    title: "test",
    agent: "parent",
    model: null,
    at: 0,
    parts: parts ?? [toolPart({ tool, status, exit, error, startedAgo })],
  }];
  const insertSession = db.prepare("insert into session values (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insertPart = db.prepare("insert into part values (?, ?, ?, ?, ?)");
  sessionRows.forEach((row, sessionIndex) => {
    const rowParts = row.parts ?? [];
    const latestPartAt = rowParts.reduce((latest, part) => Math.max(latest, part.at ?? 0), row.at ?? 0);
    const sessionTime = nowMs + latestPartAt * 1000;
    insertSession.run(
      row.id,
      row.parent_id ?? null,
      row.title ?? row.id,
      directory,
      row.agent ?? null,
      row.model ?? null,
      nowMs + (row.at ?? 0) * 1000,
      sessionTime,
      row.time_archived ?? null,
    );
    rowParts.forEach((part, partIndex) => {
      const time = nowMs + part.at * 1000;
      insertPart.run(`prt_${sessionIndex}_${partIndex}`, row.id, time, time, JSON.stringify(part.data));
    });
  });
  db.close();
  let logDir = retryLogDir;
  if (retryLines.length > 0) {
    logDir = await mkdtemp(join(directory, "opencode-log-"));
    await writeFile(join(logDir, "2026-07-13T214400.log"), `${retryLines.join("\n")}\n`);
  }
  const cursorPath = retryCursor ?? join(directory, "provider-retry-cursor.json");

  const args = [
    watcher,
    "--db", dbPath,
    "--session", session,
    "--quiet-threshold", "60",
    "--stuck-threshold", "180",
    "--now-ms", String(nowMs),
    "--once",
    "--retry-cursor", cursorPath,
  ];
  if (logDir) args.push("--retry-log-dir", logDir);
  if (disableProviderRetry) args.push("--provider-retry", "off");
  const completed = spawnSync(process.execPath, args, { encoding: "utf8" });
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

test("single same-session provider retry is quiet", async () => {
  const output = await assess({
    parts: [toolPart({ tool: "write", status: "completed", at: -120 })],
    retryLines: [retryLine({ at: -10 })],
  });
  assert.equal(output.health, "quiet");
  assert.equal(output.reason, "Provider is retrying the request.");
  assert.equal(output.provider_retry.active, true);
  assert.equal(output.provider_retry.attempts, 1);
  assert.equal(output.provider_retry.statusCode, 429);
});

test("repeated same-session provider retries are stuck", async () => {
  const output = await assess({
    parts: [toolPart({ tool: "write", status: "completed", at: -120 })],
    retryLines: [
      retryLine({ at: -30, retryDelay: 5 }),
      retryLine({ at: -20, retryDelay: 5 }),
      retryLine({ at: -10, retryDelay: 5 }),
    ],
  });
  assert.equal(output.health, "stuck");
  assert.equal(output.reason, "Provider retries are preventing progress.");
  assert.equal(output.provider_retry.attempts, 3);
});

test("provider retry older than stuck threshold is stuck", async () => {
  const output = await assess({
    parts: [toolPart({ tool: "write", status: "completed", at: -300 })],
    retryLines: [retryLine({ at: -200, retryDelay: 300 })],
  });
  assert.equal(output.health, "stuck");
  assert.equal(output.provider_retry.attempts, 1);
});

test("retry for another session preserves DB health", async () => {
  const output = await assess({ retryLines: [retryLine({ session: "ses_other", at: -10 })] });
  assert.equal(output.health, "idle");
  assert.equal(output.provider_retry.active, false);
});

test("retry without session id is ignored", async () => {
  const output = await assess({ retryLines: [retryLine({ session: null, at: -10 })] });
  assert.equal(output.health, "idle");
  assert.equal(output.provider_retry.active, false);
});

test("stale provider retry past TTL is ignored", async () => {
  const output = await assess({ retryLines: [retryLine({ at: -600, retryDelay: 30 })] });
  assert.equal(output.health, "idle");
  assert.equal(output.provider_retry.active, false);
});

test("provider retry clears when newer DB activity exists", async () => {
  const output = await assess({
    parts: [toolPart({ tool: "write", status: "completed", at: -5 })],
    retryLines: [retryLine({ at: -30 })],
  });
  assert.equal(output.health, "idle");
  assert.equal(output.provider_retry.active, false);
});

test("provider retry clears when newer running tool exists", async () => {
  const output = await assess({
    parts: [toolPart({ tool: "bash", status: "running", at: -5, startedAgo: 5 })],
    retryLines: [retryLine({ at: -30 })],
  });
  assert.equal(output.health, "active");
  assert.equal(output.provider_retry.active, false);
});

test("malformed provider retry log preserves DB health", async () => {
  const output = await assess({ retryLines: ["not a valid retry line"] });
  assert.equal(output.health, "idle");
  assert.equal(output.provider_retry.active, false);
});

test("missing provider retry log directory preserves DB health", async () => {
  const output = await assess({ retryLogDir: join(tmpdir(), "does-not-exist-awc-provider-retry") });
  assert.equal(output.health, "idle");
  assert.equal(output.provider_retry.active, false);
});

test("retryable auth provider errors are ignored in 0.2.4", async () => {
  const output = await assess({
    retryLines: [retryLine({ at: -10, statusCode: 401, status: "UNAUTHENTICATED", retryDelay: null, retryable: true })],
  });
  assert.equal(output.health, "idle");
  assert.equal(output.provider_retry.active, false);
});

function parentChildSessions({ parentParts = [toolPart({ tool: "read", status: "completed", at: -60 })], children = [] } = {}) {
  return [
    {
      id: "ses_parent",
      parent_id: null,
      title: "parent",
      agent: "parent-agent",
      parts: parentParts,
    },
    ...children.map((child, index) => ({
      id: child.id ?? `ses_child_${index + 1}`,
      parent_id: "ses_parent",
      title: child.title ?? `child ${index + 1}`,
      agent: child.agent ?? `child-${index + 1}`,
      model: child.model ?? null,
      parts: child.parts ?? [],
    })),
  ];
}

test("no_children preserves parent-only overall health", async () => {
  const output = await assess({
    session: "ses_parent",
    sessions: parentChildSessions(),
  });
  assert.equal(output.health, "idle");
  assert.equal(output.overall.cause, "parent");
  assert.equal(output.parent.health, "idle");
  assert.equal(output.children_summary.total, 0);
});

test("parent_idle_child_active makes overall active", async () => {
  const output = await assess({
    session: "ses_parent",
    sessions: parentChildSessions({
      children: [{ agent: "explore", parts: [toolPart({ tool: "bash", status: "running", at: -10, startedAgo: 10 })] }],
    }),
  });
  assert.equal(output.health, "active");
  assert.equal(output.parent.health, "idle");
  assert.equal(output.overall.cause, "child");
  assert.equal(output.children_summary.active, 1);
  assert.match(output.reason, /Child explore is active/);
});

test("parent_idle_child_quiet makes overall quiet", async () => {
  const output = await assess({
    session: "ses_parent",
    sessions: parentChildSessions({
      children: [{ parts: [toolPart({ tool: "bash", status: "running", at: -10, startedAgo: 90 })] }],
    }),
  });
  assert.equal(output.health, "quiet");
  assert.equal(output.children_summary.quiet, 1);
});

test("parent_idle_child_stuck makes overall stuck", async () => {
  const output = await assess({
    session: "ses_parent",
    sessions: parentChildSessions({
      children: [{ parts: [toolPart({ tool: "bash", status: "running", at: -240, startedAgo: 240 })] }],
    }),
  });
  assert.equal(output.health, "stuck");
  assert.equal(output.children_summary.stuck, 1);
});

test("parent_active_child_failed makes overall failed", async () => {
  const output = await assess({
    session: "ses_parent",
    sessions: parentChildSessions({
      parentParts: [toolPart({ tool: "bash", status: "running", at: -5, startedAgo: 5 })],
      children: [{ agent: "test-agent", parts: [toolPart({ tool: "bash", status: "completed", exit: 1, at: -10 })] }],
    }),
  });
  assert.equal(output.health, "failed");
  assert.equal(output.parent.health, "active");
  assert.equal(output.children_summary.failed, 1);
  assert.match(output.reason, /Child test-agent is failed/);
});

test("multiple_children_mixed_health chooses highest priority child", async () => {
  const output = await assess({
    session: "ses_parent",
    sessions: parentChildSessions({
      children: [
        { agent: "explore", parts: [toolPart({ tool: "bash", status: "running", at: -10, startedAgo: 10 })] },
        { agent: "librarian", parts: [toolPart({ tool: "bash", status: "running", at: -10, startedAgo: 90 })] },
        { agent: "test-agent", parts: [toolPart({ tool: "bash", status: "completed", exit: 1, at: -20 })] },
      ],
    }),
  });
  assert.equal(output.health, "failed");
  assert.equal(output.children_summary.active, 1);
  assert.equal(output.children_summary.quiet, 1);
  assert.equal(output.children_summary.failed, 1);
  assert.equal(output.children[0].name, "test-agent");
});

test("old_idle_children_do_not_pollute_overall", async () => {
  const output = await assess({
    session: "ses_parent",
    sessions: parentChildSessions({
      children: [{ parts: [toolPart({ tool: "read", status: "completed", at: -4000 })] }],
    }),
  });
  assert.equal(output.health, "idle");
  assert.equal(output.children_summary.included, 0);
  assert.equal(output.children[0].excluded_reason, "old_child");
});

test("old_failed_child_does_not_pollute_after_recent_window", async () => {
  const output = await assess({
    session: "ses_parent",
    sessions: parentChildSessions({
      children: [{ parts: [toolPart({ tool: "bash", status: "completed", exit: 1, at: -4000 })] }],
    }),
  });
  assert.equal(output.health, "idle");
  assert.equal(output.children_summary.failed, 0);
  assert.equal(output.children[0].included, false);
});

test("parent_newer_normal_finish_excludes_old_child_failure", async () => {
  const output = await assess({
    session: "ses_parent",
    sessions: parentChildSessions({
      parentParts: [stepStart({ at: -20 }), stepFinish({ at: -10, reason: "stop" })],
      children: [{ parts: [toolPart({ tool: "bash", status: "completed", exit: 1, at: -60 })] }],
    }),
  });
  assert.equal(output.health, "idle");
  assert.equal(output.children[0].included, false);
  assert.equal(output.children[0].excluded_reason, "parent_newer_normal_finish");
});

test("child_provider_retry drives overall stuck", async () => {
  const output = await assess({
    session: "ses_parent",
    sessions: parentChildSessions({
      children: [{ id: "ses_child_retry", agent: "retry-child", parts: [toolPart({ tool: "write", status: "completed", at: -120 })] }],
    }),
    retryLines: [
      retryLine({ session: "ses_child_retry", at: -30, retryDelay: 5 }),
      retryLine({ session: "ses_child_retry", at: -20, retryDelay: 5 }),
      retryLine({ session: "ses_child_retry", at: -10, retryDelay: 5 }),
    ],
  });
  assert.equal(output.health, "stuck");
  assert.equal(output.children_summary.stuck, 1);
  assert.equal(output.children[0].provider_retry.active, true);
  assert.match(output.reason, /retry-child/);
});

test("child_unknown participates in overall when recent", async () => {
  const output = await assess({
    session: "ses_parent",
    sessions: parentChildSessions({
      children: [{ parts: [toolPart({ tool: "bash", status: "completed", at: -10 })] }],
    }),
  });
  assert.equal(output.health, "unknown");
  assert.equal(output.children_summary.unknown, 1);
});

test("child_agent_name_from_session_agent", async () => {
  const output = await assess({
    session: "ses_parent",
    sessions: parentChildSessions({
      children: [{ agent: "explore", parts: [toolPart({ tool: "read", status: "completed", at: -10 })] }],
    }),
  });
  assert.equal(output.children[0].name, "explore");
});

test("fallback_child_name_from_title", async () => {
  const output = await assess({
    session: "ses_parent",
    sessions: parentChildSessions({
      children: [{ agent: "", title: "Research something (@librarian subagent)", parts: [toolPart({ tool: "read", status: "completed", at: -10 })] }],
    }),
  });
  assert.equal(output.children[0].name, "librarian");
});

test("child_sort_problem_states_first", async () => {
  const output = await assess({
    session: "ses_parent",
    sessions: parentChildSessions({
      children: [
        { agent: "active-child", parts: [toolPart({ tool: "bash", status: "running", at: -1, startedAgo: 1 })] },
        { agent: "failed-child", parts: [toolPart({ tool: "bash", status: "completed", exit: 1, at: -20 })] },
      ],
    }),
  });
  assert.equal(output.children[0].name, "failed-child");
  assert.equal(output.children[1].name, "active-child");
});

test("many_children_ui_summary exposes max five and more count", async () => {
  const children = Array.from({ length: 7 }, (_, index) => ({
    agent: `child-${index + 1}`,
    parts: [toolPart({ tool: "bash", status: "running", at: -index - 1, startedAgo: index + 1 })],
  }));
  const output = await assess({
    session: "ses_parent",
    sessions: parentChildSessions({ children }),
  });
  assert.equal(output.children_summary.total, 7);
  assert.equal(output.children_summary.included, 7);
  assert.equal(output.children_summary.shown, 5);
  assert.equal(output.children_summary.more, 2);
});

test("selected_child_climbs_to_root_parent", async () => {
  const output = await assess({
    session: "ses_child_1",
    sessions: parentChildSessions({
      children: [{ parts: [toolPart({ tool: "bash", status: "running", at: -10, startedAgo: 10 })] }],
    }),
  });
  assert.equal(output.parent.session_id, "ses_parent");
  assert.equal(output.parent.selected_session_id, "ses_child_1");
  assert.equal(output.health, "active");
});
