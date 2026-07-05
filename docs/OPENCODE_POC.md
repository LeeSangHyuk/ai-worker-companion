# OpenCode Companion PoC

This PoC validates whether AI Worker Companion can be called from OpenCode without changing the Core Engine.

OpenCode is the first integration target only. The product remains agent-agnostic.

## Decision

Chosen first path:

```text
OpenCode Slash Command
        |
        v
integrations/opencode/adapter/session_state_adapter.py
        |
        v
session_state.py
        |
        v
Session State / Handoff Prompt
```

## Why Slash Command First

OpenCode supports several extension points:

1. Custom slash commands
2. Local plugins
3. Event hooks through plugins
4. Custom tools

For this Companion MVP, slash command is the smallest real PoC path.

Reasons:

- It is official OpenCode behavior.
- It can be project-local under `.opencode/commands/`.
- It supports shell output injection with `!` command syntax.
- It calls the existing `session_state.py` without changing the Core Engine.
- It is explicitly user-triggered, so it does not create silent automation.
- It can produce either a readable state view or a handoff prompt.

The plugin skeleton is still included, but only as the future notification/status hook surface.

## What Was Built

```text
integrations/opencode/
  README.md
  adapter/
    session_state_adapter.py
  .opencode/
    commands/
      companion-state.md
      companion-handoff.md
    plugins/
      agent-companion.js
```

## Command PoC

### `/companion-state`

File:

```text
integrations/opencode/.opencode/commands/companion-state.md
```

Behavior:

```text
OpenCode command
  -> shell output injection
  -> adapter
  -> session_state.py --format markdown
  -> markdown state shown inside OpenCode
```

Purpose:

- Show Current Goal
- Show Current Situation
- Show Blocker
- Give the agent/human enough context to continue

### `/companion-handoff`

File:

```text
integrations/opencode/.opencode/commands/companion-handoff.md
```

Behavior:

```text
OpenCode command
  -> shell output injection
  -> adapter
  -> session_state.py --resume
  -> handoff prompt shown inside OpenCode
```

Purpose:

- Prepare a recovery/handoff prompt
- Keep recovery human-approved
- Avoid automatic new-session execution

## Plugin Skeleton

File:

```text
integrations/opencode/.opencode/plugins/agent-companion.js
```

Current behavior:

- Initializes as an OpenCode local plugin module.
- Logs that the Companion plugin skeleton was loaded.
- Observes selected session events:
  - `session.idle`
  - `session.error`
  - `session.status`
- Does not call `session_state.py` automatically.
- Does not start recovery.
- Does not modify prompts.

Why keep it:

- It validates where future notification/status behavior should live.
- It gives us a place to later map OpenCode events to Companion notifications.

Why not make plugin the first working path:

- The Companion MVP first needs a reliable, explicit invocation path.
- Event-driven notification behavior is more product-sensitive.
- Automatic status interpretation can look like supervision, which is not the current goal.

## Notification PoC Decision

For this PoC:

```text
Primary notification path: Slash command output
Future notification path: Plugin event hook
```

In other words:

- `/companion-state` is the minimum callable path.
- `/companion-handoff` is the minimum recovery path.
- `agent-companion.js` is only a status/notification hook skeleton.

We are not yet implementing:

- persistent status badge inside OpenCode
- automatic popup
- automatic stuck detection
- automatic recovery

## How to Try Locally

From the repository root:

```powershell
python integrations/opencode/adapter/session_state_adapter.py --format markdown
python integrations/opencode/adapter/session_state_adapter.py --resume
```

To expose commands to OpenCode, copy or symlink:

```text
integrations/opencode/.opencode
```

to the OpenCode project root as:

```text
.opencode
```

Then in OpenCode:

```text
/companion-state
/companion-handoff
```

## Input Selection

The adapter defaults to:

```text
outputs/representations_full_124_gemini_3_1_flash_lite
```

Override with:

```powershell
$env:SESSION_STATE_INPUT = "path/to/representations"
```

or:

```powershell
python integrations/opencode/adapter/session_state_adapter.py --input path/to/representations --format markdown
```

## Architecture Boundary

The OpenCode adapter owns:

- OpenCode command files
- OpenCode plugin skeleton
- calling the Core CLI
- formatting the invocation path

The Core Engine still owns:

- representation parsing
- session state rendering
- resume prompt generation

The Companion still owns:

- UX mock
- notification abstraction
- recovery UX boundary

## Source Basis

OpenCode documentation confirms:

- local plugins live in `.opencode/plugins/`
- command files live in `.opencode/commands/`
- command files can use shell output injection with `!` command syntax
- plugin modules export plugin functions and can observe events
- session events and TUI-related events are part of the plugin event model

References:

- <https://opencode.ai/docs/plugins>
- <https://opencode.ai/docs/commands>

## Result

This PoC establishes a real integration skeleton:

```text
OpenCode
  -> Adapter
  -> Core Engine
  -> Companion state / handoff output
```

The project is still not OpenCode-specific. OpenCode is only the first adapter.
