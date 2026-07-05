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

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const EXAMPLE_INPUT = "examples/session.state.example.json";

function repoRootFromDirectory(directory) {
  return resolve(directory ?? process.cwd());
}

function readCompanionState(directory) {
  const root = repoRootFromDirectory(directory);
  const inputPath = process.env.SESSION_STATE_INPUT
    ? resolve(root, process.env.SESSION_STATE_INPUT)
    : join(root, EXAMPLE_INPUT);

  if (!existsSync(inputPath)) {
    return {
      status: "Unknown",
      currentState: `No representation input found at ${inputPath}`,
      lastUpdate: "unavailable",
      source: inputPath,
    };
  }

  try {
    const raw = readFileSync(inputPath, "utf8");
    const data = JSON.parse(raw);
    const blockerStatus = data?.blocker?.status;
    const status =
      blockerStatus === "blocked"
        ? "Stuck"
        : blockerStatus === "needs_human"
          ? "Needs Human"
          : blockerStatus === "none_observed"
            ? "Working"
            : "Unknown";
    const currentState =
      data?.current_situation?.summary ??
      data?.goal_stack?.active_goal?.value ??
      "No current state summary in representation input.";
    const lastUpdate = statSync(inputPath).mtime.toLocaleString();

    return {
      status,
      currentState,
      lastUpdate,
      source: inputPath,
    };
  } catch (error) {
    return {
      status: "Unknown",
      currentState: `Failed to read representation input: ${error instanceof Error ? error.message : String(error)}`,
      lastUpdate: "unavailable",
      source: inputPath,
    };
  }
}

function oneLine(value, max = 96) {
  const line = String(value ?? "").replace(/\s+/g, " ").trim();
  if (line.length <= max) return line;
  return `${line.slice(0, max - 3)}...`;
}

function compactTime(value) {
  if (!value || value === "unavailable") return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function textNode(solid, props, value) {
  const node = solid.createElement("text");
  for (const [name, propValue] of Object.entries(props)) {
    solid.setProp(node, name, propValue);
  }
  solid.insert(node, value);
  return node;
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

function renderPromptSurface(solid, theme, state) {
  return textNode(
    solid,
    { fg: state.status === "Unknown" ? theme.warning : theme.textMuted },
    `Companion: ${state.status} | ${oneLine(state.currentState, 48)}`,
  );
}

function renderBottomSurface(solid, theme, state) {
  return textNode(
    solid,
    { fg: state.status === "Unknown" ? theme.warning : theme.textMuted, wrapMode: "none" },
    `Companion: ${state.status} | ${oneLine(state.currentState, 58)} | ${compactTime(state.lastUpdate)}`,
  );
}

function renderSidebarSurface(solid, theme, state) {
  return boxNode(
    solid,
    {
      borderStyle: "single",
      borderColor: theme.border,
      flexDirection: "column",
      padding: 1,
    },
    [
      textNode(solid, { fg: state.status === "Unknown" ? theme.warning : theme.info }, `Companion: ${state.status}`),
      textNode(solid, { fg: theme.textMuted }, `Current State: ${oneLine(state.currentState, 72)}`),
      textNode(solid, { fg: theme.textMuted }, `Last Update: ${state.lastUpdate}`),
    ],
  );
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

  const state = readCompanionState(api.state?.path?.directory ?? process.cwd());
  const renderers = {
    app_bottom: () => renderBottomSurface(solid, api.theme.current, state),
    session_prompt_right: () => renderPromptSurface(solid, api.theme.current, state),
    sidebar_content: () => renderSidebarSurface(solid, api.theme.current, state),
  };

  api.slots.register({
    order: 950,
    slots: renderers,
  });
  api.renderer?.requestRender?.();

  if (state.status === "Unknown") {
    api.ui?.toast?.({
      variant: "warning",
      title: "AI Worker Companion",
      message: "State input is unavailable.",
      duration: 4000,
    });
  }
};
