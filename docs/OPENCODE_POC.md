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

On macOS, use `python3`:

```sh
python3 integrations/opencode/adapter/session_state_adapter.py --format markdown
python3 integrations/opencode/adapter/session_state_adapter.py --resume
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

## macOS OpenCode TUI Verification

Verified on a MacBook OpenCode TUI from:

```text
/Users/hyuk/project/ai-worker-companion
```

The test project root used a symlink:

```text
.opencode -> integrations/opencode/.opencode
```

The public clone did not include the default generated representation folder. The adapter now falls back to the sanitized public example when no generated output folder is present:

```sh
opencode .
```

The same input can be selected explicitly:

```sh
SESSION_STATE_INPUT="$PWD/examples/session.state.example.json" opencode .
```

Observed in the OpenCode command palette:

```text
/companion-state
/companion-handoff
```

Observed `/companion-state` result:

```text
Status: healthy
Blocker: none_observed
Next Action: Continue from the current goal without restarting from scratch.
```

Observed `/companion-handoff` result:

```text
You are continuing an AI agent session.

Current Goal:
Review the current agent state and prepare a safe handoff if the work needs to continue elsewhere.

Instructions:
Continue from this state. Do not restart from scratch. Use the current goal and blocker as the immediate context.
```

The verification confirmed that OpenCode can call the Companion PoC from the MacBook TUI without changing the Core Engine, Extractor, schema, `session_state.py`, Companion UX, or recovery behavior.

## macOS Command Notes

The command files use `python3` because the tested macOS shell did not provide a `python` executable. Without this, OpenCode command execution can fail with:

```text
zsh:1: command not found: python
```

The command files also include:

```text
Do not run additional shell commands.
```

This keeps the OpenCode agent from treating the injected Companion output as a request to run another command. The intended slash command behavior is:

```text
OpenCode command
  -> inject adapter output
  -> show or summarize the injected output
  -> stop
```

This preserves the PoC boundary: no automatic recovery, no extra extraction, and no unrequested session restart.

## From Slash Command to Always-On Companion

The `/companion-state` command is a successful technical PoC:

```text
OpenCode TUI
  -> project slash command
  -> adapter
  -> session_state.py
  -> Companion state output
```

However, the UX is still not the final product experience. Requiring the user to type `/companion-state` every time is useful for validation, but it is too manual for an always-on Companion.

The next PoC target is an OpenCode plugin/event-based Companion that can react to state changes, tool events, session events, or TUI events without requiring repeated manual slash command invocation.

Before implementing that, verify:

1. Whether the OpenCode plugin lifecycle supports a startup hook.
2. Whether the plugin can receive session, tool, and TUI events reliably.
3. Whether the plugin can show toast or desktop notifications.
4. Whether OpenCode exposes a persistent UI surface for status display.
5. If no persistent surface exists, whether event-driven notification alone is enough for the MVP.

This next step should still preserve the current recovery boundary:

- no automatic recovery
- no automatic new session
- no new hosted LLM API
- no Extractor or schema changes
- no Companion UX rewrite

## Persistent TUI Companion PoC

Verified on the same MacBook OpenCode TUI from:

```text
/Users/hyuk/project/ai-worker-companion
```

The test project root used:

```text
.opencode -> integrations/opencode/.opencode
```

The TUI plugin is registered by project-local config:

```text
integrations/opencode/.opencode/tui.json
```

which loads:

```text
integrations/opencode/.opencode/tui-plugins/agent-companion.js
```

That wrapper imports the `tui` export from:

```text
integrations/opencode/.opencode/plugins/agent-companion.js
```

The wrapper is required because OpenCode expects a plugin module default export to be either a server plugin or a TUI plugin. Keeping the server plugin and TUI plugin as separate entrypoints avoids default-export ambiguity while preserving the existing slash command fallback path.

Observed result:

```text
Companion: Working | The agent has completed the initial inspection and iden...
```

Surface findings:

1. `app_bottom`: confirmed. It displayed a compact persistent Companion line without the user typing `/companion-state`.
2. `session_prompt_right`: registered, but not visually confirmed in the final home-screen verification.
3. `sidebar_content`: registered, but not visually confirmed in the final home-screen verification.
4. `ui.toast`: useful only as a secondary warning. A success toast was distracting, so it was removed. The PoC keeps a warning toast only when the state is `Unknown` because representation input is unavailable or unreadable.
5. `attention.notify`: not used in this PoC.

The `app_bottom` line is currently the most realistic MVP surface because it is visible without an explicit slash command and does not require a separate session prompt or sidebar state to be open.

The TUI status surface intentionally shows only:

- `Status`: `Working`, `Needs Human`, `Stuck`, or `Unknown`
- `Current State`: one compact line
- `Last Update`: compact timestamp

This PoC did not add automatic recovery, automatic new-session execution, hosted LLM API calls, Extractor changes, schema changes, or `session_state.py` changes.

### TUI Dependency Metadata

The persistent TUI surface uses OpenCode's TUI slot API and renders with `@opentui/solid`.

The repository tracks:

```text
integrations/opencode/.opencode/package.json
```

to make the required dependencies explicit:

```text
@opencode-ai/plugin
@opentui/solid
```

The repository does not track `node_modules/` or the generated `package-lock.json`. The current lockfile was generated from a local symlinked `.opencode` path and is not necessary for the PoC record. Reproduce the local dependency install from:

```sh
cd integrations/opencode/.opencode
npm install
```

## Input Selection

The adapter chooses input in this order:

1. Explicit `--input` argument.
2. `SESSION_STATE_INPUT` environment variable.
3. Default generated output folder: `outputs/representations_full_124_gemini_3_1_flash_lite`.
4. Public fallback example: `examples/session.state.example.json`.

Override with:

```powershell
$env:SESSION_STATE_INPUT = "path/to/representations"
```

or:

```powershell
python integrations/opencode/adapter/session_state_adapter.py --input path/to/representations --format markdown
```

For a public clone without generated outputs, use:

```sh
python3 integrations/opencode/adapter/session_state_adapter.py --format markdown

python3 integrations/opencode/adapter/session_state_adapter.py --resume
```

or select the example explicitly:

```sh
export SESSION_STATE_INPUT="$PWD/examples/session.state.example.json"
python3 integrations/opencode/adapter/session_state_adapter.py --format markdown
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
