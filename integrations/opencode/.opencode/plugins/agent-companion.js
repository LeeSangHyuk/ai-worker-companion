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
