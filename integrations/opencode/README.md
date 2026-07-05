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
  - Minimal plugin skeleton for future notification/status hooks.
- `adapter/session_state_adapter.py`
  - Thin bridge from OpenCode to the repo-level `session_state.py`.

## Local test

From the repository root:

```powershell
python integrations/opencode/adapter/session_state_adapter.py --format markdown
python integrations/opencode/adapter/session_state_adapter.py --resume
```

To use in OpenCode, copy or symlink `integrations/opencode/.opencode` to the project root as `.opencode`.

The adapter defaults to:

```text
outputs/representations_full_124_gemini_3_1_flash_lite
```

Override it with:

```powershell
$env:SESSION_STATE_INPUT = "path/to/representations"
```

or:

```powershell
python integrations/opencode/adapter/session_state_adapter.py --input path/to/representations
```
