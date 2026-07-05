# OpenCode Adapter PoC

This is the first integration PoC for AI Worker Companion.

OpenCode is only the first experimental host. The Companion remains agent-agnostic.

## Chosen MVP path

The first working path is a custom slash command:

```text
/companion-state
        |
        v
integrations/opencode/adapter/session_state_adapter.py
        |
        v
session_state.py
        |
        v
markdown session state shown inside OpenCode
```

Why slash command first:

- OpenCode custom commands are official and lightweight.
- Commands can inject shell output with `!` command syntax.
- The Core Engine does not need to change.
- The user explicitly invokes the Companion, so there is no silent automation.

The plugin skeleton is included only to validate the future event/notification direction.

## Files

- `.opencode/commands/companion-state.md`
  - Calls the adapter and injects markdown session state.
- `.opencode/commands/companion-handoff.md`
  - Calls the adapter with `--resume` and injects a handoff prompt.
- `.opencode/plugins/agent-companion.js`
  - Minimal plugin skeleton plus TUI status-surface export.
- `.opencode/tui.json`
  - Project-local OpenCode TUI plugin registration.
- `.opencode/tui-plugins/agent-companion.js`
  - TUI-only wrapper around the Companion `tui` export.
- `.opencode/package.json`
  - TUI plugin dependency metadata.
- `adapter/session_state_adapter.py`
  - Thin bridge from OpenCode to the repo-level `session_state.py`.

## Local test

From the repository root:

```powershell
python integrations/opencode/adapter/session_state_adapter.py --format markdown
python integrations/opencode/adapter/session_state_adapter.py --resume
```

On macOS:

```sh
python3 integrations/opencode/adapter/session_state_adapter.py --format markdown
python3 integrations/opencode/adapter/session_state_adapter.py --resume
```

To use in OpenCode, copy or symlink `integrations/opencode/.opencode` to the project root as `.opencode`.

The adapter chooses input in this order:

1. Explicit `--input` argument.
2. `SESSION_STATE_INPUT` environment variable.
3. Default generated output folder: `outputs/representations_full_124_gemini_3_1_flash_lite`.
4. Public fallback example: `examples/session.state.example.json`.

Override it with:

```powershell
$env:SESSION_STATE_INPUT = "path/to/representations"
```

or:

```powershell
python integrations/opencode/adapter/session_state_adapter.py --input path/to/representations
```

## MacBook OpenCode test

This PoC was verified in the OpenCode TUI on macOS from the repository root:

```text
/Users/hyuk/project/ai-worker-companion
```

Apply the OpenCode project config with either copy or symlink. The verified setup used a symlink:

```sh
ln -s integrations/opencode/.opencode .opencode
```

For a public clone that does not include generated `outputs/`, the adapter falls back to the sanitized example input:

```sh
cd ai-worker-companion
opencode
```

Then run:

```text
/companion-state
```

You can also select the example explicitly:

```sh
SESSION_STATE_INPUT="$PWD/examples/session.state.example.json" opencode
```

In the OpenCode TUI, confirm that both commands appear:

```text
/companion-state
/companion-handoff
```

Expected `/companion-state` output includes:

```text
Status: healthy
Blocker: none_observed
Next Action: Continue from the current goal without restarting from scratch.
```

Expected `/companion-handoff` output starts with:

```text
You are continuing an AI agent session.
```

and includes the current goal, previous goals, current situation, blocker, key evidence, and continuation instructions.

The command files use `python3` because macOS may not provide `python` in `zsh`. They also tell OpenCode not to run additional shell commands so the TUI shows the injected Companion output instead of attempting a second command. This keeps recovery human-approved and avoids automatic new-session execution.

## Persistent TUI Companion test

The slash commands remain the explicit fallback path, but the MacBook OpenCode TUI PoC also verified a persistent Companion status surface.

The tested setup used a symlink from the repository root:

```sh
ln -s integrations/opencode/.opencode .opencode
```

The TUI status surface also needs project-local TUI config:

```text
integrations/opencode/.opencode/tui.json
```

which registers:

```text
./tui-plugins/agent-companion.js
```

Install the local TUI rendering dependency once:

```sh
cd integrations/opencode/.opencode
npm install
cd ../../..
```

The repository tracks `.opencode/package.json` so the required dependencies are visible:

```text
@opencode-ai/plugin
@opentui/solid
```

The repository intentionally does not track `.opencode/node_modules/` or the generated `package-lock.json`. The lockfile generated during the MacBook test contained local symlink path details and is not required to reproduce this PoC.

For a public clone without generated `outputs/`, run OpenCode with the sanitized example input:

```sh
SESSION_STATE_INPUT="$PWD/examples/session.state.example.json" opencode .
```

Expected persistent TUI result:

```text
Companion: Working | The agent has completed the initial inspection and iden...
```

Confirmed surface:

```text
app_bottom
```

Registered but not fully visually confirmed in the final home-screen verification:

```text
session_prompt_right
sidebar_content
```

The PoC removed success toast usage because it was distracting in the TUI. A warning toast remains only when the state is `Unknown`, usually because representation input is unavailable or unreadable.
