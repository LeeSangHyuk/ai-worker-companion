# Companion Platform Fit: OpenCode vs Codex

This document evaluates which platform is currently better suited for the intended AI Worker Companion UX.

The goal is not:

```text
user types a command -> sees session state
```

The goal is:

```text
AI works quietly
  -> Companion stays out of the way
  -> Companion calls the human when attention/recovery is needed
```

Target architecture:

```text
Any Agent
  -> Agent Adapter
  -> Companion
  -> Notification
  -> Recovery
```

No implementation changes are made by this document.

## Evaluation Standard

For this review, “Companion-friendly” means the host can support most of the following:

- persistent or always-available UI
- event-driven status updates
- notification when attention is needed
- human intervention popup or equivalent
- handoff/recovery prompt display
- low-friction adapter that can call the Core Engine
- clear plugin lifecycle and extension surface

Slash commands alone are not enough for the desired product UX.

## OpenCode Capability Review

Source basis:

- OpenCode plugin docs: <https://opencode.ai/docs/plugins>
- OpenCode command docs: <https://opencode.ai/docs/commands>

### Summary

OpenCode is the stronger first target for an event-driven Companion PoC.

It does not currently provide enough official evidence for a fully custom “always visible side panel / floating widget” UX. However, it does officially provide:

- project/global plugin loading
- plugin lifecycle at startup
- session/tool/file/TUI event hooks
- shell execution from plugins
- notification examples
- desktop notification behavior for response/session error
- custom slash commands as an explicit fallback path

That makes it suitable for:

```text
quiet background observer
  -> event hook
  -> notification
  -> human-triggered handoff
```

It is less suitable, based only on official docs, for:

```text
always-visible custom Companion rail inside the OpenCode UI
```

### OpenCode UI / Extension Surface Table

| Capability | Support | Implementation path | Limitations | Official basis |
|---|---:|---|---|---|
| Status Bar | Not confirmed | No official plugin status bar API found. | OpenCode has TUI/desktop/IDE surfaces, but plugin docs do not document a persistent status bar API. | Plugin docs list TUI events but not status bar rendering. |
| Side Panel | Not confirmed | No official side panel API found. | IDE surface exists, but docs do not show plugin-created side panel. | Main docs list IDE usage; plugin docs do not expose side panel API. |
| Bottom Panel | Not confirmed | No official bottom panel API found. | Could be possible in IDE host, but not established by OpenCode plugin docs. | No documented bottom panel API in plugin docs. |
| Webview | Not confirmed | No official webview API found. | Cannot assume custom embedded HTML UI. | No documented webview API in plugin docs. |
| Floating Widget | Not confirmed | No official floating widget API found. | Browser mock cannot be directly mapped to an OpenCode floating widget from current docs. | No documented floating widget API. |
| Notification | Supported / Partial | Plugin can respond to events and run a system notification command; desktop app also sends system notifications for response ready/session errors. | Example uses macOS `osascript`; cross-platform notification needs adapter work. Desktop automatic notifications are not a custom Companion UI. | Plugin docs “Send notifications”; note about desktop app notifications. |
| Event / Hook | Supported | Plugins return hook/event handlers; official event list includes command, file, permission, session, tool, TUI, and shell events. | Event payload depth and stable transcript access need real host validation. | Plugin docs event list. |
| Background process | Partial | Plugins are loaded at startup; plugin context includes Bun shell `$` for commands. | Long-running daemon semantics are not clearly documented. Should avoid hidden background automation in MVP. | Plugin docs local/plugin loading and Bun shell context. |
| Plugin lifecycle | Supported | Local plugins in `.opencode/plugins/` and global plugins in `~/.config/opencode/plugins/` are automatically loaded at startup. npm plugins are configured and installed/cached. | Lifecycle is startup-loaded; hot reload behavior is not the main Companion path. | Plugin docs “Use a plugin,” “Load order,” and “Create a plugin.” |
| Slash Command | Supported | `.opencode/commands/*.md`; command executed by typing `/command`; shell output can be injected with `!command`. | Good fallback / manual trigger, but not enough for “always alive Companion.” | Command docs. |

### OpenCode Fit for Intended UX

OpenCode can credibly support:

- event-driven attention signals
- notification when session is idle/error/status changes
- handoff command as user-approved recovery path
- adapter calling the Core Engine

OpenCode cannot yet be claimed to support:

- custom persistent Companion rail
- custom side panel
- custom floating widget
- embedded webview Companion UI

Verdict:

```text
MVP Fit for always-alive Companion: Medium
MVP Fit for event-driven notification Companion: High
MVP Fit for slash-command state viewer: High
```

## Codex Capability Review

Source basis:

- OpenAI Codex manual helper was attempted first, as required by the local OpenAI docs workflow, but could not run because Node.js is not available in this environment.
- Direct fetch of the public Codex manual URL also failed from this environment.
- Therefore, this section distinguishes:
  - confirmed in the current Codex environment
  - not confirmed by public official docs in this pass

This is intentionally conservative.

### Summary

Codex is promising as a Core Engine consumer, but the official/public evidence available in this pass is not enough to select it as the first platform for an always-alive Companion UI.

What is visible in the current Codex environment:

- skills exist
- plugins exist
- MCP/app/tool surfaces exist
- local CLI commands can be run in the workspace
- Codex can render markdown/text responses in the conversation

What is not confirmed from official public docs in this pass:

- custom persistent UI outside the conversation
- status bar API
- sidebar/panel API
- notification API for third-party plugins
- event hook API suitable for passive Companion monitoring
- direct transcript/session access from a plugin

### Codex UI / Extension Surface Table

| Capability | Support | Implementation path | Limitations | Official basis |
|---|---:|---|---|---|
| User-defined custom UI | Not confirmed | Current environment can show conversation output and use app/browser surfaces, but third-party persistent UI API is not confirmed. | Cannot assume a custom Companion rail/sidebar. | Public manual could not be fetched; no official UI API confirmed in this pass. |
| Status UI | Not confirmed | No confirmed status bar/status badge API for third-party Codex plugins. | Conversation output is not equivalent to always-visible status. | Not confirmed. |
| Sidebar | Not confirmed | No confirmed third-party sidebar API. | Current Codex app has its own thread UI, but plugin-created sidebar is not established. | Not confirmed. |
| Panel | Not confirmed | No confirmed plugin panel API. | Browser/app surfaces exist in current environment, but not as a documented Companion plugin target. | Not confirmed. |
| Notification | Not confirmed | No confirmed third-party notification API from public official docs in this pass. | Could be possible through future app/plugin surfaces, but should not be assumed. | Not confirmed. |
| Tool UI | Partial / environment-confirmed | Current environment exposes tools/apps/connectors and can show tool results in conversation. | Tool output is not an always-alive Companion UI. | Confirmed by current runtime, not public docs in this pass. |
| Plugin | Environment-confirmed, public-doc unverified in this pass | Current runtime includes plugin-provided skills/tools. | Plugin packaging exists in this environment, but stable public UI extension capabilities are not confirmed. | Current Codex environment. |
| Skill | Environment-confirmed, public-doc unverified in this pass | Skills can package reusable workflows/instructions. | Skills are task workflows, not persistent UI. | Current Codex environment. |
| MCP | Environment-confirmed, public-doc unverified in this pass | MCP/app connectors can expose tools/data. | MCP is not itself a Companion display surface. | Current Codex environment. |
| Background execution | Partial / environment-confirmed | Current environment has automation/thread concepts, but not validated as third-party Companion runtime. | Do not assume passive monitoring over arbitrary Codex sessions. | Current Codex environment. |
| Event / Hook | Environment-mentioned, public-doc unverified in this pass | Local guidance references hooks as lifecycle enforcement. | Exact hook API and event stream for Companion monitoring not confirmed. | Current Codex environment; public manual unavailable. |
| Always visible outside conversation | Not confirmed | No verified API for a persistent Companion widget outside the active conversation. | This is the key blocker for choosing Codex first. | Not confirmed. |

### Codex Fit for Intended UX

Codex can credibly support:

- CLI-driven state rendering
- markdown handoff output
- skill/plugin-style invocation
- Core Engine as a local tool

Codex cannot yet be claimed to support:

- always-visible Companion rail
- third-party status bar/panel
- third-party popup notification
- passive event-driven Companion monitoring

Verdict:

```text
MVP Fit for always-alive Companion: Low
MVP Fit for event-driven notification Companion: Low / Unknown
MVP Fit for command/skill state viewer: Medium
```

This does not mean Codex is unsuitable long term. It means Codex should not be the first target for proving the intended Companion UX unless official plugin UI/event documentation becomes available.

## OpenCode vs Codex Comparison

| Criterion | OpenCode | Codex | Better first target |
|---|---|---|---|
| Companion always displayed | Not confirmed. No official persistent widget/panel API found. | Not confirmed. No public official third-party persistent UI API verified in this pass. | Neither |
| Notification | Supported / partial. Official plugin notification example and desktop notification note. | Not confirmed from public official docs in this pass. | OpenCode |
| Human intervention popup | Partial. Can approximate through OS notification or TUI toast/event path, but no custom popup API confirmed. | Not confirmed. | OpenCode |
| Recovery UX | Strong through slash command and shell output injection; plugin can later trigger guidance. | Medium through CLI/skill-style output, but persistent UI path unconfirmed. | OpenCode |
| Handoff | Strong. `/companion-handoff` style command is officially aligned with command docs. | Medium. Can print handoff in conversation/tool output, but plugin path less clear. | OpenCode |
| Adapter implementation difficulty | Low-medium. Commands and plugins have clear project-local locations. | Medium-unknown. Core CLI invocation is easy; plugin integration boundary less clear. | OpenCode |
| Plugin development difficulty | Medium. Official plugin structure, context, events, and examples exist. | Unknown-medium. Current environment has plugin concepts, but public UI/event API was not verified. | OpenCode |
| Maintenance | Medium. OpenCode plugin/event API is documented, but event payload stability must be tested. | Unknown. Depends on official plugin/skill surface stability and availability. | OpenCode |
| Long-term extensibility | Medium-high for agent-native event hooks and notification. Lower for custom persistent UI unless webview/panel APIs appear. | Medium long-term if Codex exposes stable plugin UI/hooks; low evidence today. | OpenCode |

## MVP Fit Rating

### OpenCode

```text
MVP Fit: High for event-driven notification Companion
MVP Fit: Medium for always-alive visible Companion
```

OpenCode is the better first integration target because official docs already support the most important runtime pieces:

- plugins
- startup loading
- session/tool/TUI events
- shell execution
- notifications
- commands as manual fallback

### Codex

```text
MVP Fit: Medium for Core CLI / skill-style handoff
MVP Fit: Low for always-alive visible Companion
```

Codex should remain a target, but not the first target for proving the Companion UX.

The current evidence supports Codex as:

- a consumer of `session_state.py`
- a place to show markdown/handoff output
- a possible future plugin host

The current evidence does not yet support Codex as:

- a host for a persistent Companion UI
- a notification-first Companion runtime
- a passive monitoring surface outside conversation turns

## Conclusion

For the intended product:

```text
AI works quietly.
When human attention is needed, Companion naturally calls the human.
Recovery remains human-approved handoff, not automatic restart.
```

OpenCode is currently the better first integration target.

Reason:

- It has official plugin lifecycle documentation.
- It exposes event hooks relevant to session/tool/status behavior.
- It has an official notification example.
- It has command support as a safe fallback.
- It can support an event-driven Companion before a full custom UI exists.

However, we should be precise:

OpenCode is not yet proven to support the full visual Companion mock as an always-visible side rail or floating widget.

The near-term OpenCode PoC should therefore be:

```text
OpenCode plugin event
  -> detect attention-worthy session state
  -> show notification / toast / system notification
  -> user invokes handoff or state command
  -> Core Engine renders state or recovery prompt
```

Codex should be kept as a second-stage target:

```text
Codex skill/plugin or CLI wrapper
  -> call Core Engine
  -> show markdown state / handoff
```

We should not choose Codex first for the “always alive Companion” validation until official docs confirm third-party UI, notification, and event-hook surfaces suitable for passive monitoring.

## Product Implication

The product category should remain agent-agnostic:

```text
Any Agent
  -> Agent Adapter
  -> Companion
  -> Notification
  -> Recovery
```

The first adapter should be OpenCode because it gives the strongest current path to validate:

```text
quiet agent work -> event signal -> human notification -> handoff recovery
```

The first milestone should not be a beautiful persistent UI.

The first milestone should be:

```text
Can the Companion reliably know when to call the human inside a real agent runtime?
```

OpenCode is the better platform for answering that question now.
