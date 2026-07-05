# AI Worker Companion Mock

This is a UX prototype, not the final integration.

The goal is to test a small companion that sits beside an AI agent workspace. It is not meant to feel like a standalone JSON viewer.

Core idea:

> AI workers shouldn't fail silently.

## Main UX

The main flow is intentionally small:

```text
status → attention → recovery
```

- When the agent is working, the companion stays quiet.
- When the agent needs a human decision, it asks for attention.
- When the session appears stuck, it suggests recovery.

Details are secondary. Goal history and evidence live in the Details drawer, not in the default rail.

## Demo states

- `Working`: quiet status only.
- `Needs Human`: asks for a human decision.
- `Session Stuck`: suggests preparing a handoff.

## Recovery boundary

Recovery does not start a new session.

It only generates a handoff/resume prompt that a human can copy into another agent session.

## Debug JSON loading

In a real integration, the companion would receive session state automatically from the host agent.

This static prototype keeps a `Developer Debug Panel` only for local testing:

- load `*.representation.json`
- paste `session_state.py --format json` output
- load the current demo state

The debug panel is not part of the final product UX.

## Plugin-friendly seams

This mock is intentionally structured so a future agent integration can replace the browser-only pieces:

- `notifications/notification.js` exposes `showNotification(type, payload)`.
- `recovery/recovery.js` exposes `generateHandoff(sessionState)`.
- `state/state.js` exposes `normalizeSessionState(raw)`.

The current implementation renders browser dialogs and drawers. A real OpenCode, Codex, Claude Code, Cursor, or VS Code adapter can keep the same status → attention → recovery flow while replacing notifications and host-specific state delivery.

## Agent-agnostic rule

The mock can look like an OpenCode-style workspace for the first demo, but the product should not be OpenCode-specific.

Use generic concepts:

- AI Worker
- Agent
- Agent Session
- Companion
- Handoff
- Recovery

Avoid hard-coding agent-specific paths, commands, or lifecycle assumptions.
