import test from "node:test";
import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  listLogFiles,
  parseRetryLogText,
  readProviderRetryState,
  selectActiveRetryForSession,
  selectLatestLogFile,
  summarizeRetryEvents,
} from "../../integrations/opencode/adapter/provider_retry_parser.js";

const fixtures = fileURLToPath(new URL("provider-retry-fixtures/", import.meta.url));

async function parseFixture(name, options = {}) {
  const file = join(fixtures, name);
  const text = await readFile(file, "utf8");
  return parseRetryLogText(text, { file, ...options });
}

function retryLineAt(timestamp, {
  session = "ses_current",
  provider = "google",
  model = "gemini-2.5-flash",
  retryDelay = 5,
} = {}) {
  return `ERROR ${timestamp} +100ms service=llm providerID=${provider} modelID=${model} session.id=${session} error={"error":{"name":"AI_APICallError","statusCode":429,"responseBody":"{\\"error\\":{\\"code\\":429,\\"status\\":\\"RESOURCE_EXHAUSTED\\",\\"details\\":[{\\"@type\\":\\"type.googleapis.com/google.rpc.RetryInfo\\",\\"retryDelay\\":\\"${retryDelay}s\\"}]}}","isRetryable":true,"data":{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}}} stream error`;
}

function selectRetryHealth(summaries, { nowMs = Date.parse("2026-07-13T12:48:20Z") } = {}) {
  return selectActiveRetryForSession(summaries, {
    sessionId: "ses_current",
    nowMs,
    ttlSeconds: 300,
    stuckThresholdSeconds: 180,
  });
}

test("single_retry_429 extracts provider retry metadata only", async () => {
  const [event] = await parseFixture("single_retry_429.txt");
  assert.equal(event.providerID, "google");
  assert.equal(event.modelID, "gemini-2.5-flash");
  assert.equal(event.session_id, "ses_current");
  assert.equal(event.statusCode, 429);
  assert.equal(event.status, "RESOURCE_EXHAUSTED");
  assert.equal(event.retryDelaySeconds, 31);
  assert.equal(event.isRetryable, true);
  assert.equal("responseBody" in event, false);
});

test("wrapped OpenCode AI_APICallError extracts nested retry metadata", () => {
  const line = 'ERROR 2026-07-13T21:44:00 +100ms service=llm providerID=google modelID=gemini-2.5-flash session.id=ses_current error={"error":{"name":"AI_APICallError","statusCode":429,"responseBody":"{\\"error\\":{\\"code\\":429,\\"status\\":\\"RESOURCE_EXHAUSTED\\",\\"details\\":[{\\"@type\\":\\"type.googleapis.com/google.rpc.RetryInfo\\",\\"retryDelay\\":\\"42s\\"}]}}","isRetryable":true,"data":{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}}} stream error';
  const [event] = parseRetryLogText(line);
  assert.equal(event.statusCode, 429);
  assert.equal(event.status, "RESOURCE_EXHAUSTED");
  assert.equal(event.retryDelaySeconds, 42);
  assert.equal(event.isRetryable, true);
});

test("OpenCode structured timestamps without timezone suffix are parsed as UTC", () => {
  const events = parseRetryLogText([
    retryLineAt("2026-07-13T12:48:07"),
    retryLineAt("2026-07-13T12:48:12"),
    retryLineAt("2026-07-13T12:48:17"),
  ].join("\n"));
  const nowMs = Date.parse("2026-07-13T12:48:20Z");
  const summaries = summarizeRetryEvents(events, { nowMs, ttlSeconds: 300 });
  const selected = selectRetryHealth(summaries, { nowMs });
  assert.equal(events[0].epoch_ms, Date.parse("2026-07-13T12:48:07Z"));
  assert.equal(summaries[0].is_stale, false);
  assert.equal(selected.health, "stuck");
  assert.equal(selected.reason, "Provider retries are preventing progress.");
});

test("structured retry detection does not depend on hot retry TUI text", () => {
  const text = [
    retryLineAt("2026-07-13T12:48:07"),
    retryLineAt("2026-07-13T12:48:12"),
    retryLineAt("2026-07-13T12:48:17"),
  ].join("\n");
  const nowMs = Date.parse("2026-07-13T12:48:20Z");
  const events = parseRetryLogText(text);
  const summaries = summarizeRetryEvents(events, { nowMs, ttlSeconds: 300 });
  const selected = selectRetryHealth(summaries, { nowMs });
  assert.equal(/gemini is way too hot right now|retrying in|attempt #/i.test(text), false);
  assert.equal(selected.health, "stuck");
});

test("repeated_retry_same_session summarizes retry sequence", async () => {
  const events = await parseFixture("repeated_retry_same_session.txt");
  const [summary] = summarizeRetryEvents(events, { nowMs: Date.parse("2026-07-13T21:44:08Z"), ttlSeconds: 300 });
  assert.equal(events.length, 3);
  assert.equal(summary.session_id, "ses_current");
  assert.equal(summary.attempts, 3);
  assert.equal(summary.last_retryDelaySeconds, 13);
  assert.equal(summary.is_stale, false);
});

test("retry_other_session can be filtered out by session", async () => {
  assert.equal((await parseFixture("retry_other_session.txt", { session: "ses_current" })).length, 0);
  assert.equal((await parseFixture("retry_other_session.txt", { session: "ses_other" })).length, 1);
});

test("malformed_retry_log skips broken lines and keeps valid retry events", async () => {
  const events = await parseFixture("malformed_retry_log.txt");
  assert.equal(events.length, 1);
  assert.equal(events[0].retryDelaySeconds, 5);
});

test("rotated_log selection uses newest timestamped log filename", async () => {
  const directory = await mkdtemp(join(tmpdir(), "awc-retry-logs-"));
  await writeFile(join(directory, "2026-07-13T214000.log"), await readFile(join(fixtures, "rotated_log_old.txt"), "utf8"));
  await writeFile(join(directory, "2026-07-13T214100.log"), await readFile(join(fixtures, "rotated_log_new.txt"), "utf8"));
  const files = listLogFiles(directory);
  const latest = selectLatestLogFile(directory);
  assert.equal(files.length, 2);
  assert.equal(latest.name, "2026-07-13T214100.log");
});

test("opencode.log without retry does not shadow date-named provider retry logs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "awc-retry-log-shadow-"));
  const cursorPath = join(directory, "cursor.json");
  const retryLog = join(directory, "2026-07-13T120313.log");
  const opencodeLog = join(directory, "opencode.log");
  await writeFile(retryLog, [
    retryLineAt("2026-07-13T12:48:07"),
    retryLineAt("2026-07-13T12:48:12"),
    retryLineAt("2026-07-13T12:48:17"),
  ].join("\n"));
  await writeFile(opencodeLog, "INFO 2026-07-13T12:48:19 +1ms service=app started\n");
  await utimes(retryLog, new Date("2026-07-13T12:48:17Z"), new Date("2026-07-13T12:48:17Z"));
  await utimes(opencodeLog, new Date("2026-07-13T12:48:20Z"), new Date("2026-07-13T12:48:20Z"));

  const nowMs = Date.parse("2026-07-13T12:48:20Z");
  const state = readProviderRetryState({ logDir: directory, cursorPath, nowMs, ttlSeconds: 300 });
  const selected = selectRetryHealth(state.summaries, { nowMs });
  assert.equal(state.ok, true);
  assert.equal(state.log_path, retryLog);
  assert.equal(selected.health, "stuck");
  assert.equal(selected.attempts, 3);
});

test("stale_retry_past_ttl is marked stale by summary", async () => {
  const events = await parseFixture("stale_retry_past_ttl.txt");
  const [summary] = summarizeRetryEvents(events, { nowMs: Date.parse("2026-07-13T21:55:00Z"), ttlSeconds: 300 });
  assert.equal(summary.is_stale, true);
});

test("retry_then_successful_activity parser only captures retry event", async () => {
  const events = await parseFixture("retry_then_successful_activity.txt");
  assert.equal(events.length, 1);
  assert.equal(events[0].session_id, "ses_current");
});

test("provider_error_without_retry_delay captures retryable provider errors", async () => {
  const [event] = await parseFixture("provider_error_without_retry_delay.txt");
  assert.equal(event.providerID, "anthropic");
  assert.equal(event.statusCode, 503);
  assert.equal(event.status, "UNAVAILABLE");
  assert.equal(event.retryDelaySeconds, null);
  assert.equal(event.isRetryable, true);
});

test("multiple_sessions_multiple_providers keeps session and provider separation", async () => {
  const events = await parseFixture("multiple_sessions_multiple_providers.txt");
  const summaries = summarizeRetryEvents(events, { nowMs: Date.parse("2026-07-13T21:44:03Z"), ttlSeconds: 300 });
  assert.equal(events.length, 3);
  assert.equal(summaries.length, 3);
  assert.deepEqual([...new Set(summaries.map((item) => item.session_id))].sort(), ["ses_a", "ses_b"]);
  assert.equal(summaries.filter((item) => item.session_id === "ses_a").length, 2);
  assert.equal(summaries.find((item) => item.session_id === "ses_b").providerID, "anthropic");
});

test("cursor incremental read preserves retry attempts across watcher runs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "awc-retry-cursor-"));
  const log = join(directory, "2026-07-13T214400.log");
  const cursorPath = join(directory, "cursor.json");
  await writeFile(log, await readFile(join(fixtures, "single_retry_429.txt"), "utf8"));
  let state = readProviderRetryState({ logDir: directory, cursorPath, nowMs: Date.parse("2026-07-13T21:44:30Z") });
  assert.equal(state.summaries[0].attempts, 1);
  await appendFile(log, await readFile(join(fixtures, "single_retry_429.txt"), "utf8"));
  state = readProviderRetryState({ logDir: directory, cursorPath, nowMs: Date.parse("2026-07-13T21:44:31Z") });
  assert.equal(state.summaries[0].attempts, 2);
  assert.equal(state.events.length, 1);
});

test("malformed cursor safely resets without failing retry parsing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "awc-retry-bad-cursor-"));
  const log = join(directory, "2026-07-13T214400.log");
  const cursorPath = join(directory, "cursor.json");
  await writeFile(log, await readFile(join(fixtures, "single_retry_429.txt"), "utf8"));
  await writeFile(cursorPath, "{not json");
  const state = readProviderRetryState({ logDir: directory, cursorPath, nowMs: Date.parse("2026-07-13T21:44:30Z") });
  assert.equal(state.ok, true);
  assert.equal(state.summaries[0].attempts, 1);
});

test("log truncate resets cursor and rereads current log safely", async () => {
  const directory = await mkdtemp(join(tmpdir(), "awc-retry-truncate-"));
  const log = join(directory, "2026-07-13T214400.log");
  const cursorPath = join(directory, "cursor.json");
  await writeFile(log, await readFile(join(fixtures, "repeated_retry_same_session.txt"), "utf8"));
  let state = readProviderRetryState({ logDir: directory, cursorPath, nowMs: Date.parse("2026-07-13T21:44:30Z") });
  assert.equal(state.summaries[0].attempts, 3);
  await writeFile(log, await readFile(join(fixtures, "single_retry_429.txt"), "utf8"));
  state = readProviderRetryState({ logDir: directory, cursorPath, nowMs: Date.parse("2026-07-13T21:44:31Z") });
  assert.equal(state.ok, true);
  assert.equal(state.summaries[0].attempts, 1);
});

test("log rotation resets cursor to newest log", async () => {
  const directory = await mkdtemp(join(tmpdir(), "awc-retry-rotation-"));
  const cursorPath = join(directory, "cursor.json");
  await writeFile(join(directory, "2026-07-13T214000.log"), await readFile(join(fixtures, "rotated_log_old.txt"), "utf8"));
  let state = readProviderRetryState({ logDir: directory, cursorPath, nowMs: Date.parse("2026-07-13T21:40:30Z") });
  assert.equal(state.summaries[0].last_retryDelaySeconds, 31);
  await writeFile(join(directory, "2026-07-13T214100.log"), await readFile(join(fixtures, "rotated_log_new.txt"), "utf8"));
  state = readProviderRetryState({ logDir: directory, cursorPath, nowMs: Date.parse("2026-07-13T21:41:30Z") });
  assert.equal(state.summaries[0].last_retryDelaySeconds, 20);
});

test("readProviderRetryState does not emit raw sensitive log fields", async () => {
  const directory = await mkdtemp(join(tmpdir(), "awc-retry-sensitive-"));
  const log = join(directory, "2026-07-13T214400.log");
  await writeFile(log, await readFile(join(fixtures, "single_retry_429.txt"), "utf8"));
  const state = readProviderRetryState({ logDir: directory, cursorPath: join(directory, "cursor.json") });
  const serialized = JSON.stringify(state);
  assert.equal(/responseBody|requestBodyValues|contents|functionCall|functionResponse|prompt|raw/i.test(serialized), false);
});
