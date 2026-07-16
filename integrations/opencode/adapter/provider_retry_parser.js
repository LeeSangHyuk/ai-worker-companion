#!/usr/bin/env node

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";

const RETRY_INFO_TYPE = "type.googleapis.com/google.rpc.RetryInfo";
const DEFAULT_TAIL_BYTES = 1024 * 1024;
const DEFAULT_TTL_SECONDS = 300;
const ACTIVE_RETRY_MIN_SECONDS = 90;
const ACTIVE_RETRY_GRACE_SECONDS = 30;

export function defaultLogDir({ env = process.env, osPlatform = platform() } = {}) {
  const home = env.HOME || env.USERPROFILE || homedir();
  if (osPlatform === "win32") return resolve(home, ".local", "share", "opencode", "log");
  return resolve(home, ".local", "share", "opencode", "log");
}

export function defaultCursorPath({ env = process.env } = {}) {
  const home = env.HOME || env.USERPROFILE || homedir();
  const dataHome = env.XDG_DATA_HOME || join(home, ".local", "share");
  return resolve(dataHome, "awc", "provider-retry-cursor.json");
}

export function listLogFiles(logDir) {
  if (!existsSync(logDir)) return [];
  return readdirSync(logDir)
    .filter((name) => name.endsWith(".log"))
    .map((name) => {
      const path = resolve(logDir, name);
      const stat = statSync(path);
      return { path, name, size: stat.size, mtimeMs: stat.mtimeMs };
    })
    .sort((left, right) => {
      const byName = left.name.localeCompare(right.name);
      if (byName !== 0) return byName;
      return left.mtimeMs - right.mtimeMs;
    });
}

export function selectLatestLogFile(logDir) {
  const files = listLogFiles(logDir);
  return files.at(-1) ?? null;
}

function parseArgs(argv) {
  const values = new Map();
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    values.set(arg, value);
    index += 1;
  }
  const logDir = values.get("--log-dir") ? resolve(values.get("--log-dir")) : defaultLogDir();
  return {
    log: values.get("--log") ? resolve(values.get("--log")) : null,
    logDir,
    session: values.get("--session") ?? null,
    sinceMs: values.has("--since-ms") ? Number(values.get("--since-ms")) : null,
    ttlSeconds: values.has("--ttl-seconds") ? Number(values.get("--ttl-seconds")) : 300,
    json,
  };
}

function parseLogTimestamp(line) {
  const match = /^(TRACE|DEBUG|INFO|WARN|ERROR)\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\b/.exec(line);
  if (!match) return null;
  const epochMs = Date.parse(match[2]);
  return {
    level: match[1],
    timestamp: match[2],
    epoch_ms: Number.isFinite(epochMs) ? epochMs : null,
  };
}

function parsePrefixFields(line) {
  const stop = line.indexOf(" error=");
  const prefix = stop >= 0 ? line.slice(0, stop) : line;
  const fields = {};
  const regex = /(?:^|\s)([A-Za-z0-9_.-]+)=("[^"]*"|[^\s]+)/g;
  let match;
  while ((match = regex.exec(prefix)) !== null) {
    const raw = match[2];
    fields[match[1]] = raw.startsWith("\"") && raw.endsWith("\"") ? raw.slice(1, -1) : raw;
  }
  return fields;
}

function extractBalancedJson(text, startIndex) {
  const start = text.indexOf("{", startIndex);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function parseRetryDelaySeconds(value) {
  if (typeof value !== "string") return null;
  const match = /^([0-9]+(?:\.[0-9]+)?)s$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]);
}

function parseEmbeddedResponseBody(errorObject) {
  if (!errorObject || typeof errorObject !== "object") return null;
  const responseBody = typeof errorObject.responseBody === "string"
    ? errorObject.responseBody
    : typeof errorObject.error?.responseBody === "string"
      ? errorObject.error.responseBody
      : null;
  if (responseBody === null) return null;
  try {
    return JSON.parse(responseBody);
  } catch {
    return null;
  }
}

function findRetryDelay(errorObject) {
  const responseBody = parseEmbeddedResponseBody(errorObject);
  const details = responseBody?.error?.details;
  if (!Array.isArray(details)) return null;
  const retryInfo = details.find((item) => item?.["@type"] === RETRY_INFO_TYPE);
  return parseRetryDelaySeconds(retryInfo?.retryDelay);
}

function statusFromError(errorObject) {
  return errorObject?.data?.error?.status
    ?? errorObject?.error?.data?.error?.status
    ?? parseEmbeddedResponseBody(errorObject)?.error?.status
    ?? errorObject?.error?.status
    ?? null;
}

function statusCodeFromError(errorObject) {
  const value = errorObject?.statusCode
    ?? errorObject?.error?.statusCode
    ?? errorObject?.data?.error?.code
    ?? errorObject?.error?.data?.error?.code
    ?? parseEmbeddedResponseBody(errorObject)?.error?.code
    ?? errorObject?.error?.code
    ?? null;
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function messageHasRetrySignal(line, errorObject) {
  if (errorObject?.isRetryable === true || errorObject?.error?.isRetryable === true) return true;
  if (findRetryDelay(errorObject) !== null) return true;
  return /\bretry\b|RetryInfo|retryDelay|isRetryable/i.test(line);
}

export function parseRetryLine(line, { file = null, lineNumber = null } = {}) {
  const timestamp = parseLogTimestamp(line);
  if (!timestamp) return null;
  if (!line.includes("service=llm") || !line.includes(" error=")) return null;

  const fields = parsePrefixFields(line);
  const errorIndex = line.indexOf(" error=");
  const jsonText = extractBalancedJson(line, errorIndex);
  if (!jsonText) return null;

  let errorObject;
  try {
    errorObject = JSON.parse(jsonText);
  } catch {
    return null;
  }

  const statusCode = statusCodeFromError(errorObject);
  const retryDelaySeconds = findRetryDelay(errorObject);
  const isRetryable = errorObject?.isRetryable === true || errorObject?.error?.isRetryable === true;
  if (!messageHasRetrySignal(line, errorObject) && statusCode !== 429) return null;

  return {
    file,
    line: lineNumber,
    timestamp: timestamp.timestamp,
    epoch_ms: timestamp.epoch_ms,
    level: timestamp.level,
    providerID: fields.providerID ?? null,
    modelID: fields.modelID ?? null,
    session_id: fields["session.id"] ?? null,
    statusCode,
    status: statusFromError(errorObject),
    retryDelaySeconds,
    isRetryable,
  };
}

export function parseRetryLogText(text, { file = null, session = null, sinceMs = null } = {}) {
  const events = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const event = parseRetryLine(lines[index], { file, lineNumber: index + 1 });
    if (!event) continue;
    if (session && event.session_id !== session) continue;
    if (sinceMs !== null && event.epoch_ms !== null && event.epoch_ms < sinceMs) continue;
    events.push(event);
  }
  return events;
}

export function summarizeRetryEvents(events, { nowMs = Date.now(), ttlSeconds = 300 } = {}) {
  const bySequence = new Map();
  for (const event of events) {
    const key = retrySequenceKey(event);
    const current = bySequence.get(key) ?? {
      key,
      session_id: event.session_id,
      providerID: event.providerID,
      modelID: event.modelID,
      attempts: 0,
      first_retry_at: event.timestamp,
      first_retry_epoch_ms: event.epoch_ms,
      last_retry_at: event.timestamp,
      last_retry_epoch_ms: event.epoch_ms,
      last_statusCode: event.statusCode,
      last_status: event.status,
      last_retryDelaySeconds: event.retryDelaySeconds,
      is_stale: false,
    };
    current.attempts += 1;
    current.providerID = event.providerID ?? current.providerID;
    current.modelID = event.modelID ?? current.modelID;
    current.last_retry_at = event.timestamp;
    current.last_retry_epoch_ms = event.epoch_ms;
    current.last_statusCode = event.statusCode;
    current.last_status = event.status;
    current.last_retryDelaySeconds = event.retryDelaySeconds;
    bySequence.set(key, current);
  }
  return markStale([...bySequence.values()], { nowMs, ttlSeconds });
}

function retrySequenceKey(event) {
  return [
    event.session_id ?? "",
    event.providerID ?? "",
    event.modelID ?? "",
    event.statusCode ?? "",
    event.status ?? "",
  ].join("\u0000");
}

function markStale(summaries, { nowMs = Date.now(), ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
  return summaries.map((summary) => ({
    ...summary,
    is_stale: summary.last_retry_epoch_ms == null
      ? true
      : nowMs - summary.last_retry_epoch_ms > ttlSeconds * 1000,
  }));
}

function mergeRetrySequences(existingSummaries, events, { nowMs = Date.now(), ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
  const bySequence = new Map();
  for (const summary of existingSummaries ?? []) {
    if (!summary || typeof summary !== "object") continue;
    if (summary.session_id == null) continue;
    const key = summary.key ?? [
      summary.session_id ?? "",
      summary.providerID ?? "",
      summary.modelID ?? "",
      summary.last_statusCode ?? "",
      summary.last_status ?? "",
    ].join("\u0000");
    bySequence.set(key, { ...summary, key });
  }
  for (const event of events) {
    const key = retrySequenceKey(event);
    const current = bySequence.get(key) ?? {
      key,
      session_id: event.session_id,
      providerID: event.providerID,
      modelID: event.modelID,
      attempts: 0,
      first_retry_at: event.timestamp,
      first_retry_epoch_ms: event.epoch_ms,
      last_retry_at: event.timestamp,
      last_retry_epoch_ms: event.epoch_ms,
      last_statusCode: event.statusCode,
      last_status: event.status,
      last_retryDelaySeconds: event.retryDelaySeconds,
      is_stale: false,
    };
    current.attempts += 1;
    current.providerID = event.providerID ?? current.providerID;
    current.modelID = event.modelID ?? current.modelID;
    current.last_retry_at = event.timestamp;
    current.last_retry_epoch_ms = event.epoch_ms;
    current.last_statusCode = event.statusCode;
    current.last_status = event.status;
    current.last_retryDelaySeconds = event.retryDelaySeconds;
    bySequence.set(key, current);
  }
  return markStale([...bySequence.values()], { nowMs, ttlSeconds })
    .filter((summary) => !summary.is_stale);
}

export function publicSummary(summary) {
  if (!summary) return null;
  return {
    active: Boolean(summary.active),
    providerID: summary.providerID ?? null,
    modelID: summary.modelID ?? null,
    statusCode: summary.last_statusCode ?? null,
    status: summary.last_status ?? null,
    attempts: summary.attempts ?? 0,
    first_retry_at: summary.first_retry_at ?? null,
    last_retry_at: summary.last_retry_at ?? null,
    retryDelaySeconds: summary.last_retryDelaySeconds ?? null,
  };
}

function activeRetryUntilMs(summary) {
  if (!summary?.last_retry_epoch_ms) return null;
  const retryDelay = Number(summary.last_retryDelaySeconds);
  const activeSeconds = Math.max(
    ACTIVE_RETRY_MIN_SECONDS,
    (Number.isFinite(retryDelay) ? retryDelay : 0) + ACTIVE_RETRY_GRACE_SECONDS,
  );
  return summary.last_retry_epoch_ms + activeSeconds * 1000;
}

export function selectActiveRetryForSession(summaries, {
  sessionId,
  latestActivityMs = null,
  nowMs = Date.now(),
  ttlSeconds = DEFAULT_TTL_SECONDS,
  stuckThresholdSeconds = 180,
} = {}) {
  if (!sessionId) return null;
  const candidates = markStale(summaries, { nowMs, ttlSeconds })
    .filter((summary) => !summary.is_stale)
    .filter((summary) => summary.session_id === sessionId)
    .filter((summary) => ![401, 403].includes(Number(summary.last_statusCode)))
    .filter((summary) => summary.last_retry_epoch_ms != null)
    .filter((summary) => latestActivityMs == null || latestActivityMs <= summary.last_retry_epoch_ms)
    .filter((summary) => {
      const until = activeRetryUntilMs(summary);
      return until != null && nowMs <= until;
    })
    .sort((left, right) => (right.last_retry_epoch_ms ?? 0) - (left.last_retry_epoch_ms ?? 0));
  const selected = candidates[0];
  if (!selected) return null;
  const elapsedSeconds = Math.max(0, Math.trunc((nowMs - selected.last_retry_epoch_ms) / 1000));
  const sequenceElapsedSeconds = selected.first_retry_epoch_ms == null
    ? elapsedSeconds
    : Math.max(0, Math.trunc((nowMs - selected.first_retry_epoch_ms) / 1000));
  const stuck = selected.attempts >= 3 || sequenceElapsedSeconds >= stuckThresholdSeconds;
  return {
    ...selected,
    active: true,
    elapsed_seconds: elapsedSeconds,
    sequence_elapsed_seconds: sequenceElapsedSeconds,
    health: stuck ? "stuck" : "quiet",
    reason: stuck ? "Provider retries are preventing progress." : "Provider is retrying the request.",
  };
}

function readCursor(cursorPath) {
  try {
    const parsed = JSON.parse(readFileSync(cursorPath, "utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.log_path !== "string") return null;
    if (!Number.isFinite(Number(parsed.offset))) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCursor(cursorPath, state) {
  mkdirSync(dirname(cursorPath), { recursive: true });
  const temp = `${cursorPath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  renameSync(temp, cursorPath);
}

function readRange(path, start, end) {
  const length = Math.max(0, end - start);
  if (length === 0) return "";
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(length);
    const read = readSync(fd, buffer, 0, length, start);
    return buffer.subarray(0, read).toString("utf8");
  } finally {
    closeSync(fd);
  }
}

export function readProviderRetryState({
  logDir = defaultLogDir(),
  cursorPath = defaultCursorPath(),
  nowMs = Date.now(),
  ttlSeconds = DEFAULT_TTL_SECONDS,
  tailBytes = DEFAULT_TAIL_BYTES,
} = {}) {
  try {
    const selected = selectLatestLogFile(logDir);
    if (!selected) {
      return { ok: true, log_path: null, events: [], summaries: [], cursor: null };
    }
    const cursor = readCursor(cursorPath);
    const sameLog = cursor?.log_path === selected.path;
    const stat = statSync(selected.path);
    const size = stat.size;
    const previousOffset = sameLog && Number(cursor.offset) <= size ? Number(cursor.offset) : null;
    const start = previousOffset ?? Math.max(0, size - tailBytes);
    const text = readRange(selected.path, start, size);
    const events = parseRetryLogText(text, { file: selected.path });
    const previousSummaries = sameLog && previousOffset !== null ? cursor?.sequences : [];
    const summaries = mergeRetrySequences(previousSummaries, events, { nowMs, ttlSeconds });
    const lastEventAt = events.reduce((latest, event) => Math.max(latest, event.epoch_ms ?? 0), Number(cursor?.last_event_at ?? 0)) || null;
    writeCursor(cursorPath, {
      version: 1,
      log_path: selected.path,
      offset: size,
      size,
      mtime: Math.trunc(stat.mtimeMs / 1000),
      last_event_at: lastEventAt,
      sequences: summaries,
    });
    return {
      ok: true,
      log_path: selected.path,
      events,
      summaries,
      cursor: { log_path: selected.path, offset: size, size },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      log_path: null,
      events: [],
      summaries: [],
      cursor: null,
    };
  }
}

function sanitizeEvents(events) {
  return events.map((event) => ({
    file: event.file,
    line: event.line,
    timestamp: event.timestamp,
    providerID: event.providerID,
    modelID: event.modelID,
    session_id: event.session_id,
    statusCode: event.statusCode,
    status: event.status,
    retryDelaySeconds: event.retryDelaySeconds,
    isRetryable: event.isRetryable,
  }));
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
    return;
  }

  const selected = options.log ? { path: options.log } : selectLatestLogFile(options.logDir);
  if (!selected) {
    console.error(`No OpenCode log file found in ${options.logDir}`);
    process.exitCode = 1;
    return;
  }

  const text = readFileSync(selected.path, "utf8");
  const events = parseRetryLogText(text, {
    file: selected.path,
    session: options.session,
    sinceMs: options.sinceMs,
  });
  const output = {
    log: selected.path,
    events: sanitizeEvents(events),
    summary: summarizeRetryEvents(events, { ttlSeconds: options.ttlSeconds }),
  };
  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  for (const event of output.events) {
    console.log(`${event.timestamp} ${event.session_id ?? "-"} ${event.providerID ?? "-"}/${event.modelID ?? "-"} status=${event.statusCode ?? "-"} ${event.status ?? "-"} retryDelay=${event.retryDelaySeconds ?? "-"}s`);
  }
  if (output.events.length === 0) console.log("No provider retry events found.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
