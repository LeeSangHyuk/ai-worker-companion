# Health Model

This document defines the Health model used by `ai-worker-companion@0.2.5`.

AWC Health is evidence-based. It should explain what local OpenCode evidence was
observed and avoid pretending to know hidden model intent.

## Health enum

AWC uses six Health values:

| Value | Meaning |
|---|---|
| `idle` | No active problem evidence; work appears complete or inactive. |
| `active` | A tool, step, provider retry, parent, or child is currently active. |
| `quiet` | Work/retry is ongoing but has been quiet longer than the quiet threshold. |
| `stuck` | Work/retry has exceeded the stuck threshold or repeated retry policy. |
| `failed` | A structural failure was observed. |
| `unknown` | A reliable judgment cannot be made. |

No new Health enum values were added for Parent/Child or provider retry.

## Evidence sources

The watcher reads:

```text
OpenCode SQLite DB
  session table
  part table

OpenCode log files
  provider/model retry metadata
```

It does not use assistant natural language as a primary signal. Text like
"please wait, I am working" may be useful context for humans, but it is not
trusted as Health evidence by itself.

## Per-session evidence priority

For one session, the watcher evaluates evidence in this order:

1. Provider retry evidence for the same session.
2. Newer `step-finish reason=error`.
3. Running tool.
4. Unfinished step.
5. Session activity newer than the latest tool.
6. Completed tool.
7. No activity.

Watcher freshness is handled by the plugin. If watcher output stops refreshing,
the UI shows:

```text
Health: Unknown
Reason: Health data is stale.
```

## Tool policy

### Running tool

```text
elapsed < quiet threshold  → active
elapsed < stuck threshold  → quiet
elapsed >= stuck threshold → stuck
```

### Completed shell tool

```text
exit == 0       → idle
exit != 0       → failed
exit is missing → unknown
```

### Completed non-shell tool

```text
explicit error     → failed
no explicit error  → idle
```

## Step lifecycle policy

### `step-finish reason=error`

If a newer session step structurally finished with `reason=error`, Health is
`failed`.

### Unfinished step

If the latest `step-start` is newer than the latest `step-finish`, the step is
treated like active work:

```text
elapsed < quiet threshold  → active
elapsed < stuck threshold  → quiet
elapsed >= stuck threshold → stuck
```

### `step-finish reason=stop`

`reason=stop` alone is not failure evidence. If there is no active tool or retry,
the session can be `idle` with a reason such as:

```text
Latest session step completed; no active tool is running.
```

## Provider retry policy

The provider retry parser reads OpenCode logs and extracts metadata only:

```text
timestamp
providerID
modelID
session.id
statusCode
status
RetryInfo.retryDelay
retry sequence
```

Policy:

```text
same-session short retry sequence      → quiet
same-session repeated retry sequence   → stuck
same-session long-running retry        → stuck
other-session retry                    → ignored
retry older than TTL                   → ignored
newer same-session DB activity exists  → retry cleared
```

Provider retry does not become `failed` in 0.2.5. The user may still be able to
wait, change provider/model, or retry later.

## Parent/Child model

OpenCode direct child sessions are linked by:

```text
child.parent_id = parent.id
```

AWC evaluates:

```text
Parent session
Direct child sessions
```

Nested child UI is not implemented.

If the selected watcher session is a child, the watcher climbs to the root parent
and evaluates that parent plus its direct children.

## Child inclusion rule

Child sessions are included in Overall Health when they are likely relevant to
current work:

- child has active provider retry
- child is `active`, `quiet`, or `stuck`
- child is recent and `failed` or `unknown`
- child is recent and `idle`

Child sessions are excluded when they are stale:

- old idle child
- old failed child after the recent-child window
- child failure older than a newer normal parent `step-finish`

The default recent-child window is currently 30 minutes in the watcher.

## Overall aggregation

Top-level `health` means Overall Health.

Overall considers:

```text
Parent
Included direct children
```

Priority:

```text
failed → stuck → active → quiet → unknown → idle
```

Example:

```text
Parent: Idle
Child explore: Active

Overall: Active
Reason: Child explore is active: Tool is running...
```

## Output metadata

The watcher keeps existing top-level output and adds:

```text
overall
parent
children_summary
children
```

These fields are non-sensitive and intended for UI/debugging.

## Current limitations

- Selected TUI session routing is still limited.
- Only direct children are surfaced.
- OMO active agent/job board state is not integrated.
- Natural-language assistant text analysis is not used as a primary Health
  signal.
- Notifications are not implemented.

## Test coverage

Current npm tests cover:

- non-shell tool completion
- shell exit-code behavior
- running tool thresholds
- step lifecycle errors and unfinished steps
- provider retry quiet/stuck/clear behavior
- parent idle with child active/quiet/stuck
- parent active with child failed
- mixed children
- old child exclusion
- child naming and sorting
- max-five child display summary
