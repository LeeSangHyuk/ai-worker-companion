# Plugin PoC: AI Worker Companion

This document evaluates whether the current AI Worker Companion mock can become a real plugin/extension layer on top of coding agents.

Scope:

- No actual plugin implementation.
- No new LLM API calls.
- No extractor, schema, prompt, evaluator, or `session_state.py` changes.
- Focus only on integration feasibility and adapter seams.

The current product direction remains:

```text
Core Engine -> Agent Plugin / Extension Wrapper -> Companion UX
```

## Current Companion Integration Shape

The browser mock now has three plugin-friendly seams:

- `companion/state/state.js`
  - `normalizeSessionState(raw)`
  - Converts host-provided state into the UI shape.
- `companion/notifications/notification.js`
  - `showNotification(type, payload)`
  - Currently renders an HTML dialog.
  - Future adapters can map this to host notifications, status bars, webviews, or side panels.
- `companion/recovery/recovery.js`
  - `generateHandoff(sessionState)`
  - Generates a human-approved handoff/resume prompt.
  - Does not automatically start a new agent session.

This keeps the product flow small:

```text
status -> attention -> recovery
```

## Agent-by-Agent Feasibility Matrix

| Tool | Extension / Plugin / Command Support | Status Display Possibility | Session / Transcript Access | External CLI Call | Handoff / Resume Prompt Insertion | Notification Possibility | Key Limits / Uncertainty | MVP Fit |
|---|---|---|---|---|---|---|---|---|
| OpenCode | Yes. Docs expose custom slash commands and a plugin system. | Likely strong. Plugin docs expose toast-style UI and event hooks; IDE/terminal surfaces exist. | Likely strong through OpenCode events, but exact stable transcript contract needs validation. | Likely possible through plugin hooks or command execution, but should be verified in a real plugin sandbox. | High likelihood via custom commands or UI action that copies/prints handoff. | Strong. Plugin examples include toast-style notifications. | Need real plugin PoC to confirm access to full session state and host security boundaries. | High |
| Claude Code | Yes. Slash commands, skills, plugins, and hooks are documented. | Medium. Terminal-first; status bar/side panel is not the native surface, but hooks can emit feedback or block/continue. | Strong for local session flow: hooks include transcript path and stop/task event inputs. | Strong. Hooks can run shell commands and receive JSON input. | Medium-high. Slash commands and hooks can surface a handoff prompt; automatic insertion should remain human-approved. | Medium. Hooks can add context, block, or continue; native popup UI is less clear. | Best as “CLI/hook companion” first, not rich visual companion. | High |
| Codex | Partial. Current Codex environment supports plugins, skills, apps/connectors, hooks, and MCP-style extensions, but public plugin UI capabilities need confirmation from official Codex manual. | Medium. Markdown/text output and in-app browser/app surfaces may be possible; stable status rail/popup API is not confirmed. | Medium. This repo can expose `session_state.py`; direct Codex transcript access as a plugin input is not confirmed here. | Strong for local CLI invocation in a coding environment. | Medium-high. A Codex skill/plugin can call the Core CLI and present a resume prompt, but automatic new-session execution should be avoided. | Medium / uncertain. Depends on available Codex app/plugin surfaces. | The official manual helper could not be run locally because Node.js is unavailable in this environment. Treat UI-level plugin claims as uncertain. | Medium |
| Cursor | Likely through VS Code-compatible extension path, but direct Cursor Agent plugin APIs were not confirmed from official docs in this pass. | Strong if implemented as a VS Code-style extension: status bar, webview, side panel, notifications. | Low / uncertain for Cursor Agent internals. Workspace files and terminal output are easier than Cursor chat transcript. | Strong in a VS Code extension host via local process execution, subject to extension permissions. | Medium. Can show/copy prompt in webview or command palette; direct insertion into Cursor chat is uncertain. | Strong through VS Code notification APIs if extension-compatible. | Treat as “editor companion” first, not “Cursor Agent transcript companion,” until official APIs are confirmed. | Medium |
| VS Code / GitHub Copilot | Yes for VS Code extensions. GitHub Copilot itself is not treated as the extension host; VS Code is. | Strong: status bar, webview panel/view, notifications, command palette. | Medium for editor/terminal/workspace events; low/uncertain for private Copilot Chat transcript. | Strong. VS Code extensions can create terminals and run commands; Node extension host can invoke local tools. | Medium. Can show/copy a handoff prompt or open a webview. Direct Copilot Chat insertion is not assumed. | Strong through VS Code UI APIs. | Best initial target for generic editor-side companion, not Copilot-internal supervision. | High for UI shell, Medium for Copilot transcript |

## Detailed Notes

### OpenCode

OpenCode is the most promising first “agent-native” demo target.

Confirmed from docs:

- OpenCode is available as a terminal interface, desktop app, and IDE extension.
- It supports custom commands under `.opencode/commands/`, callable as slash commands.
- The documentation navigation exposes plugin, SDK, server, command, custom tool, MCP, and IDE surfaces.

Why it fits:

- It already treats agent customization as a first-class concept.
- The Companion UX maps cleanly to an agent-side panel or notification.
- A future adapter could call the Core CLI, then render:
  - current status
  - attention popup
  - handoff prompt

Open questions:

- Whether plugin APIs expose the complete current transcript/session state in a stable format.
- Whether a plugin can safely run an external local CLI in all OpenCode surfaces.
- Whether desktop/IDE/terminal surfaces share the same plugin UI capability.

Recommended PoC:

1. Build an OpenCode command/plugin that calls `session_state.py --format markdown`.
2. Print or display the current state.
3. Add a handoff command that calls `session_state.py --resume`.
4. Only after that, test visual notifications.

### Claude Code

Claude Code is highly feasible as a hook/slash-command integration, especially for local session recovery.

Confirmed from docs:

- Claude Code supports slash commands through `.claude/commands/`.
- It supports skills and plugins.
- Hooks receive structured JSON.
- Stop hooks include `transcript_path` and related session/task information.
- Hooks can control continuation/blocking and add context.

Why it fits:

- The Companion can begin as a terminal/hook companion without needing a rich UI.
- `transcript_path` is especially valuable for converting the current session into normalized input.
- A slash command can generate a handoff prompt on demand.

Open questions:

- Native status widget/popup support is less clear because Claude Code is terminal-first.
- The right boundary between passive observation and hook intervention needs careful design.

Recommended PoC:

1. Slash command: “show session state.”
2. Stop hook: detect when a session ended and offer handoff state.
3. Avoid auto-starting a new session.

### Codex

Codex is feasible as a Core CLI consumer, but the plugin/UI story should be validated carefully.

Confirmed in the current environment:

- Codex supports skills/plugins in this running desktop environment.
- Plugin-provided skills and MCP/app capabilities are available in this session.
- The current repo already exposes a stable CLI surface via `session_state.py`.

Not fully confirmed in this pass:

- A public, stable status bar / side panel / notification plugin API for Codex.
- Direct transcript/session-state access from a Codex plugin.

Why it still fits:

- The Core CLI can be called from plugin-like workflows.
- Markdown output from `session_state.py --format markdown` is already suitable for agent surfaces.
- Recovery can remain a copied handoff prompt, which matches the safety boundary.

Recommended PoC:

1. Treat Codex as a thin wrapper first: call the Core CLI and show markdown.
2. Do not assume a native floating companion rail until official UI extension APIs are confirmed.
3. Keep recovery as “copy handoff prompt.”

### Cursor

Cursor is likely best approached through the VS Code extension compatibility path rather than a Cursor-agent-specific plugin at first.

What is practical:

- If a VS Code extension runs in Cursor, the Companion can use status bar, webview, command palette, and notifications.
- It can read local representation JSON files or call `session_state.py`.
- It can show/copy handoff prompts.

What is uncertain:

- Direct access to Cursor Agent / chat transcript.
- Official stable APIs for inserting a resume prompt into Cursor chat.

Recommended PoC:

1. Build a VS Code-compatible extension shell.
2. Load representation JSON from a workspace folder.
3. Show status + handoff prompt in a webview.
4. Treat Cursor-specific transcript access as a later discovery task.

### VS Code / GitHub Copilot

VS Code is the most stable UI host for a Companion-style extension.

Confirmed from docs:

- VS Code extensions can create webview panels.
- VS Code extensions can create terminals.
- VS Code exposes extension UI surfaces such as status bar and notifications through its extension API.

Why it fits:

- The Companion can be embedded as:
  - status bar item
  - side panel / webview
  - command palette actions
  - notification popup
- It can call the Core CLI or read representation JSON.

Important boundary:

- GitHub Copilot should not be treated as the extension host.
- The initial integration should be a VS Code extension that can coexist with Copilot.
- Direct Copilot Chat transcript access is not assumed.

Recommended PoC:

1. VS Code extension command: “Show Agent State.”
2. Webview: render Companion rail/details.
3. Status bar: show blocked/working/unknown.
4. Recovery: copy handoff prompt.

## MVP Recommendation

Recommended order:

1. **OpenCode** for agent-native PoC.
   - Best match to the product concept.
   - Likely strong plugin/event/custom command support.
2. **Claude Code** for transcript/hook PoC.
   - Strong local transcript access path.
   - Best for validating recovery/handoff mechanics.
3. **VS Code extension** for UI PoC.
   - Most stable UI platform.
   - Good status bar/webview/notification host.
4. **Codex** after confirming official UI/plugin extension boundaries.
   - Good Core CLI consumer.
   - UI-level companion needs more confirmation.
5. **Cursor** after VS Code extension PoC.
   - Likely easiest via VS Code compatibility.
   - Cursor Agent internals should not be assumed.

## Product Implication

The Companion should not become an agent-specific app.

The durable architecture should be:

```text
Agent Session Source
        |
        v
Core Engine / session_state.py
        |
        v
Agent Adapter
        |
        v
Notification + Recovery UX
```

Agent adapters should own:

- how session state is obtained
- how status is displayed
- how notifications are delivered
- how handoff text is copied or inserted with human approval

The Core Engine should remain agent-agnostic.

## Source Notes

- OpenCode docs describe OpenCode as terminal, desktop, and IDE-capable and document custom slash commands under `.opencode/commands/`: <https://opencode.ai/docs>, <https://opencode.ai/docs/commands>
- OpenCode docs expose plugin/developer surfaces in the documentation navigation: <https://opencode.ai/docs/plugins>
- Claude Code docs document slash commands, skills, plugins, hooks, hook JSON input, `transcript_path`, and stop-hook control: <https://code.claude.com/docs/en/slash-commands>, <https://code.claude.com/docs/en/hooks>
- VS Code docs document webview panels and extension APIs: <https://code.visualstudio.com/api/extension-guides/webview>, <https://code.visualstudio.com/api/references/vscode-api>
- Codex notes are based on the current Codex desktop/plugin environment. The official Codex manual helper could not be run in this environment because Node.js is not installed, so Codex UI-level plugin claims are intentionally conservative.
