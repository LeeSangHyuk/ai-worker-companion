---
description: Generate AI Worker Companion handoff prompt
subtask: false
---

Generate a handoff prompt for continuing this AI worker session.

Do not automatically start a new session. Show the handoff text so the human can decide whether to copy it.
Do not run additional shell commands.
If state is unavailable, explain the missing input and how to fix it.
Do not infer real agent state without representation input.

!`python3 integrations/opencode/adapter/session_state_adapter.py --resume`
