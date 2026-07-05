---
description: Show AI Worker Companion session state
subtask: false
---

Show the current AI Worker Companion state for this workspace.

Use the following state as the current session context. Do not restart from scratch.
Do not run additional shell commands.
If state is unavailable, explain the missing input and how to fix it.
Do not infer real agent state without representation input.

!`python3 integrations/opencode/adapter/session_state_adapter.py --format markdown`

Explain briefly whether the worker appears to be working, waiting, blocked, or low-context.
