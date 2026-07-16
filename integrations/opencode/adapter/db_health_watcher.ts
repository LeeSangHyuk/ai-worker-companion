#!/usr/bin/env node

/** Node/TypeScript parity PoC for db_health_watcher.py. */

import { existsSync, statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  publicSummary,
  readProviderRetryState,
  selectActiveRetryForSession,
} from "./provider_retry_parser.js";

type Health = "active" | "quiet" | "stuck" | "failed" | "idle" | "unknown";

type Options = {
  db: string;
  session: string;
  pollInterval: number;
  quietThreshold: number;
  stuckThreshold: number;
  once: boolean;
  nowMs?: number;
  retryLogDir?: string;
  retryCursor?: string;
  disableProviderRetry: boolean;
};

type SessionRow = {
  id: string;
  title: string;
  directory: string;
  time_created: number;
  time_updated: number;
};

type PartRow = {
  id: string;
  time_created: number;
  time_updated: number;
  data: Record<string, unknown>;
};

type SessionActivity = {
  latestPart: PartRow | null;
  latestTool: PartRow | null;
  latestStepStart: PartRow | null;
  latestStepFinish: PartRow | null;
};

function parseArgs(argv: string[]): Options {
  const values = new Map<string, string>();
  let once = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--once") {
      once = true;
      continue;
    }
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    values.set(arg, value);
    index += 1;
  }

  const db = values.get("--db");
  if (!db) throw new Error("--db is required");
  const numberValue = (name: string, fallback: number): number => {
    const raw = values.get(name);
    if (raw === undefined) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
    return parsed;
  };
  const result: Options = {
    db: resolve(db.replace(/^~(?=$|\/)/, homedir())),
    session: values.get("--session") ?? "latest",
    pollInterval: numberValue("--poll-interval", 5),
    quietThreshold: numberValue("--quiet-threshold", 60),
    stuckThreshold: numberValue("--stuck-threshold", 180),
    once,
    disableProviderRetry: values.get("--provider-retry") === "off",
  };
  if (values.has("--now-ms")) result.nowMs = numberValue("--now-ms", Date.now());
  if (values.has("--retry-log-dir")) result.retryLogDir = resolve(values.get("--retry-log-dir")!);
  if (values.has("--retry-cursor")) result.retryCursor = resolve(values.get("--retry-cursor")!);
  if (result.pollInterval <= 0) throw new Error("--poll-interval must be > 0");
  if (result.quietThreshold < 0) throw new Error("--quiet-threshold must be >= 0");
  if (result.stuckThreshold < result.quietThreshold) {
    throw new Error("--stuck-threshold must be >= --quiet-threshold");
  }
  return result;
}

function walState(dbPath: string) {
  const path = `${dbPath}-wal`;
  try {
    const stat = statSync(path);
    return { path, exists: true, size_bytes: stat.size, mtime: Math.trunc(stat.mtimeMs / 1000), mtime_ns: Math.trunc(stat.mtimeMs * 1_000_000) };
  } catch {
    return { path, exists: false, size_bytes: null, mtime: null, mtime_ns: null };
  }
}

function nested(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return current ?? null;
}

function latestSession(db: DatabaseSync, selector: string): SessionRow | null {
  const sql = selector === "latest"
    ? "select id, title, directory, time_created, time_updated from session order by time_updated desc limit 1"
    : "select id, title, directory, time_created, time_updated from session where id = ? limit 1";
  return (selector === "latest" ? db.prepare(sql).get() : db.prepare(sql).get(selector)) as SessionRow | undefined ?? null;
}

function latestActivity(db: DatabaseSync, sessionId: string): SessionActivity {
  const rows = db.prepare(
    "select id, time_created, time_updated, data from part where session_id = ? order by time_updated desc limit 100",
  ).all(sessionId) as Array<Omit<PartRow, "data"> & { data: string }>;
  const activity: SessionActivity = {
    latestPart: null,
    latestTool: null,
    latestStepStart: null,
    latestStepFinish: null,
  };

  for (const row of rows) {
    try {
      const data = JSON.parse(row.data);
      if (!data || typeof data !== "object") continue;
      const part = { ...row, data };
      const type = data.type;
      if (activity.latestPart === null) activity.latestPart = part;
      if (type === "tool" && activity.latestTool === null) activity.latestTool = part;
      if (type === "step-start" && activity.latestStepStart === null) activity.latestStepStart = part;
      if (type === "step-finish" && activity.latestStepFinish === null) activity.latestStepFinish = part;
      if (
        activity.latestPart
        && activity.latestTool
        && activity.latestStepStart
        && activity.latestStepFinish
      ) break;
    } catch {
      // Match the Python watcher: malformed part JSON is skipped.
    }
  }
  return activity;
}

function elapsedSeconds(part: PartRow, nowMs: number): number | null {
  const startValue = nested(part.data, ["state", "time", "start"]) ?? part.time_updated;
  const endValue = nested(part.data, ["state", "time", "end"]);
  const start = Number(startValue);
  const end = endValue == null ? nowMs : Number(endValue);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.trunc((end - start) / 1000));
}

function isShellTool(tool: unknown): boolean {
  return typeof tool === "string" && ["bash", "shell"].includes(tool.toLowerCase());
}

function hasExplicitError(part: PartRow): boolean {
  return [
    nested(part.data, ["error"]),
    nested(part.data, ["state", "error"]),
    nested(part.data, ["state", "metadata", "error"]),
  ].some((value) => value !== null && value !== false && value !== "");
}

function partType(part: PartRow | null): unknown {
  return part ? nested(part.data, ["type"]) : null;
}

function stepReason(part: PartRow | null): unknown {
  return part ? nested(part.data, ["reason"]) : null;
}

function isStepUnfinished(activity: SessionActivity): boolean {
  if (!activity.latestStepStart) return false;
  if (!activity.latestStepFinish) return true;
  return activity.latestStepStart.time_updated > activity.latestStepFinish.time_updated;
}

function latestActivityPart(activity: SessionActivity): PartRow | null {
  return activity.latestPart;
}

function activityElapsedSeconds(part: PartRow, nowMs: number): number {
  return Math.max(0, Math.trunc((nowMs - part.time_updated) / 1000));
}

function result(params: {
  health: Health;
  reason: string;
  options: Options;
  refreshReason: string;
  checkedAt: number;
  session?: SessionRow | null;
  tool?: PartRow | null;
  activity?: SessionActivity | null;
  providerRetry?: Record<string, unknown> | null;
  lastActivitySeconds?: number | null;
  toolElapsed?: number | null;
}) {
  const { health, reason, options, refreshReason, checkedAt, session = null, tool = null, activity = null, providerRetry = null } = params;
  const wal = walState(options.db);
  const seconds = (value: unknown) => value == null ? null : Math.trunc(Number(value) / 1000);
  const latestPart = activity ? latestActivityPart(activity) : null;
  return {
    health,
    reason,
    source: options.db,
    checked_at: checkedAt,
    refresh_reason: refreshReason,
    session: {
      selector: options.session,
      id: session?.id ?? null,
      title: session?.title ?? null,
      directory: session?.directory ?? null,
      time_updated: seconds(session?.time_updated),
    },
    tool: {
      part_id: tool?.id ?? null,
      name: tool ? nested(tool.data, ["tool"]) : null,
      status: tool ? nested(tool.data, ["state", "status"]) : null,
      command: tool ? nested(tool.data, ["state", "input", "command"]) : null,
      exit: tool ? nested(tool.data, ["state", "metadata", "exit"]) : null,
      started_at: tool ? seconds(nested(tool.data, ["state", "time", "start"])) : null,
      ended_at: tool ? seconds(nested(tool.data, ["state", "time", "end"])) : null,
      elapsed_seconds: params.toolElapsed ?? null,
    },
    last_activity_seconds: params.lastActivitySeconds ?? null,
    activity: {
      latest_activity_type: partType(latestPart),
      latest_activity_at: seconds(latestPart?.time_updated),
      latest_tool_at: seconds(tool?.time_updated),
      latest_step_reason: stepReason(activity?.latestStepFinish ?? null),
      latest_step_start_at: seconds(activity?.latestStepStart?.time_updated),
      latest_step_finish_at: seconds(activity?.latestStepFinish?.time_updated),
    },
    provider_retry: providerRetry ?? { active: false },
    thresholds: { quiet_seconds: options.quietThreshold, stuck_seconds: options.stuckThreshold },
    wal: { path: wal.path, exists: wal.exists, size_bytes: wal.size_bytes, mtime: wal.mtime },
  };
}

function providerRetryEvidence(options: Options, session: SessionRow, activity: SessionActivity, nowMs: number) {
  if (options.disableProviderRetry) return null;
  const retryState = readProviderRetryState({
    ...(options.retryLogDir ? { logDir: options.retryLogDir } : {}),
    ...(options.retryCursor ? { cursorPath: options.retryCursor } : {}),
    nowMs,
    ttlSeconds: 300,
  });
  if (!retryState.ok) return null;
  const latestPart = latestActivityPart(activity);
  const activeRetry = selectActiveRetryForSession(retryState.summaries, {
    sessionId: session.id,
    latestActivityMs: latestPart?.time_updated ?? null,
    nowMs,
    ttlSeconds: 300,
    stuckThresholdSeconds: options.stuckThreshold,
  });
  return activeRetry;
}

function assess(options: Options, refreshReason: string) {
  // Python uses integer epoch seconds before converting back to milliseconds.
  const nowMs = options.nowMs ?? Math.trunc(Date.now() / 1000) * 1000;
  const checkedAt = Math.trunc(nowMs / 1000);
  const base = { options, refreshReason, checkedAt };
  if (!existsSync(options.db)) return result({ ...base, health: "unknown", reason: "OpenCode DB file does not exist." });

  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(options.db, { readOnly: true, timeout: 1000 });
    const session = latestSession(db, options.session);
    if (!session) return result({ ...base, health: "unknown", reason: "No matching OpenCode session found." });
    const activity = latestActivity(db, session.id);
    const tool = activity.latestTool;
    const latestPart = latestActivityPart(activity);
    const latestActivitySeconds = latestPart ? activityElapsedSeconds(latestPart, nowMs) : null;
    const activityDetails = { ...base, session, tool, activity, lastActivitySeconds: latestActivitySeconds };

    const providerRetry = providerRetryEvidence(options, session, activity, nowMs);
    if (providerRetry) {
      return result({
        ...activityDetails,
        health: providerRetry.health,
        reason: providerRetry.reason,
        providerRetry: publicSummary(providerRetry),
      });
    }

    const latestStepFinish = activity.latestStepFinish;
    const latestStepReason = stepReason(latestStepFinish);
    const latestStepFinishIsError = latestStepReason === "error"
      && (!tool || latestStepFinish!.time_updated >= tool.time_updated);
    if (latestStepFinishIsError) {
      return result({
        ...activityDetails,
        health: "failed",
        reason: "Latest session step finished with error.",
      });
    }

    if (!tool) {
      if (isStepUnfinished(activity)) {
        const stepElapsed = activityElapsedSeconds(activity.latestStepStart!, nowMs);
        if (stepElapsed < options.quietThreshold) return result({ ...activityDetails, health: "active", reason: `Session step is active for ${stepElapsed}s, below quiet threshold.` });
        if (stepElapsed < options.stuckThreshold) return result({ ...activityDetails, health: "quiet", reason: `Session step is active for ${stepElapsed}s, below stuck threshold.` });
        return result({ ...activityDetails, health: "stuck", reason: `Session step is active for ${stepElapsed}s, exceeding stuck threshold.` });
      }
      return result({ ...activityDetails, health: "idle", reason: latestPart ? "Latest session activity completed; no tool has run in the selected session yet." : "No activity has run in the selected session yet." });
    }

    const status = nested(tool.data, ["state", "status"]);
    const toolName = nested(tool.data, ["tool"]);
    const exit = nested(tool.data, ["state", "metadata", "exit"]);
    const toolElapsed = elapsedSeconds(tool, nowMs);
    const details = { ...activityDetails, toolElapsed };

    if (status === "running") {
      if (toolElapsed === null) return result({ ...details, health: "unknown", reason: "Tool is running but start time could not be determined." });
      if (toolElapsed < options.quietThreshold) return result({ ...details, health: "active", reason: `Tool is running for ${toolElapsed}s, below quiet threshold.` });
      if (toolElapsed < options.stuckThreshold) return result({ ...details, health: "quiet", reason: `Tool is running for ${toolElapsed}s, below stuck threshold.` });
      return result({ ...details, health: "stuck", reason: `Tool is running for ${toolElapsed}s, exceeding stuck threshold.` });
    }

    if (isStepUnfinished(activity) && activity.latestStepStart!.time_updated > tool.time_updated) {
      const stepElapsed = activityElapsedSeconds(activity.latestStepStart!, nowMs);
      if (stepElapsed < options.quietThreshold) return result({ ...details, health: "active", reason: `Session step is active for ${stepElapsed}s, below quiet threshold.` });
      if (stepElapsed < options.stuckThreshold) return result({ ...details, health: "quiet", reason: `Session step is active for ${stepElapsed}s, below stuck threshold.` });
      return result({ ...details, health: "stuck", reason: `Session step is active for ${stepElapsed}s, exceeding stuck threshold.` });
    }

    if (latestPart && latestPart.time_updated > tool.time_updated) {
      const latestType = partType(latestPart);
      return result({
        ...details,
        health: "idle",
        reason: latestType === "step-finish"
          ? "Latest session step completed; no active tool is running."
          : "Latest session activity completed; no active tool is running.",
      });
    }

    if (status === "completed") {
      if (exit != null) {
        if (exit === 0) return result({ ...details, health: "idle", reason: "Latest tool completed successfully." });
        return result({ ...details, health: "failed", reason: `Latest tool completed with non-zero exit code ${exit}.` });
      }
      if (hasExplicitError(tool)) return result({ ...details, health: "failed", reason: "Latest tool completed with an explicit error." });
      if (isShellTool(toolName)) return result({ ...details, health: "unknown", reason: "Shell tool completed but exit code is missing." });
      return result({ ...details, health: "idle", reason: "Latest non-shell tool completed without an error." });
    }
    return result({ ...details, health: "unknown", reason: `Unknown or unsupported tool status: ${JSON.stringify(status)}.` });
  } catch (error) {
    return result({ ...base, health: "unknown", reason: `OpenCode DB could not be read: ${error instanceof Error ? error.message : String(error)}` });
  } finally {
    db?.close();
  }
}

async function main() {
  let options: Options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
    return;
  }

  let previousWal: string | null = null;
  do {
    const wal = walState(options.db);
    const signature = JSON.stringify([wal.exists, wal.size_bytes, wal.mtime_ns]);
    const refreshReason = previousWal === null ? "initial" : signature === previousWal ? "safety_poll" : "wal_changed";
    previousWal = signature;
    const output = assess(options, refreshReason);
    console.log(JSON.stringify(output));
    if (options.once) {
      process.exitCode = output.health === "unknown" ? 1 : 0;
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, options.pollInterval * 1000));
  } while (true);
}

await main();
