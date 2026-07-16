# Changelog

## 0.2.5 - Unreleased

### Changed

- Add direct Parent/Child session Health visibility using OpenCode `session.parent_id`.
- Compute top-level Health as Overall Health across the selected parent and included direct children.
- Keep Parent Health separate from Overall Health so a parent can be `Idle` while a child is `Active`,
  `Quiet`, `Stuck`, `Failed`, or `Unknown`.
- Add child summary metadata to watcher output, including child counts by Health state and a display limit.
- Show `Overall`, `Parent`, `Children`, and up to five child details in the OpenCode sidebar.
- Reuse existing session lifecycle, tool, and provider retry evidence for each direct child session.
- Exclude old idle or old failed child sessions from Overall Health after the recent-child window, and
  avoid letting older child failures override a newer normal parent step finish.

### Validation

- Added fixtures for parent idle with child active/quiet/stuck, parent active with child failed,
  mixed child states, old child exclusion, child provider retry, child unknown, child naming,
  problem-state sorting, display limit handling, and selected-child root parent resolution.

### Deferred

- Recursive/nested child UI, OMO integration, selected TUI session routing, natural-language assistant
  text analysis, notifications, and new Health enum values remain out of scope.

## 0.2.4

### Changed

- Detect same-session OpenCode provider/model retry evidence from local OpenCode logs.
- Map active same-session provider retries to `quiet` for short retry sequences and `stuck`
  for repeated or long-running retry sequences.
- Clear retry evidence when newer same-session DB activity appears, preventing stale provider
  retries from overriding current Health.
- Add a cursor-backed OpenCode log reader so retry detection does not reread full log files
  every polling cycle.
- Add non-sensitive `provider_retry` metadata to watcher output.

### Validation

- Added fixtures for same-session retries, repeated retries, other-session retries, missing
  session IDs, stale retry TTL, retry clearing after newer DB activity, malformed logs, cursor
  recovery, truncation, rotation, and sensitive field redaction.

### Deferred

- Parent/Child agent Health visibility, Overall Health aggregation, OMO integration, selected
  TUI session routing, natural-language assistant text analysis, notification features, and
  final 401/403 auth/config error policy remain out of scope.

### Next milestone candidate

- Parent/Child agent health visibility:
  `Overall: Active`, `Parent: Idle`, `Children: 2 active, 1 failed`.

## 0.2.3

### Changed

- Consider latest session lifecycle activity alongside the latest tool when computing Health.
- Give newer `step-finish` errors priority over older completed tools.
- Treat unfinished session steps as `active`, `quiet`, or `stuck` using the existing quiet/stuck thresholds.
- Avoid presenting an older completed tool as the current reason when newer session activity exists.
- Add non-sensitive activity metadata to watcher output for debugging:
  `latest_activity_type`, `latest_activity_at`, `latest_tool_at`, `latest_step_reason`,
  `latest_step_start_at`, and `latest_step_finish_at`.

### Validation

- Added fixtures for newer step errors, newer completed session activity, unfinished step thresholds,
  running tool precedence over older step evidence, and stale watcher behavior.

### Deferred

- Provider retry detection, OpenCode log parsing, OMO subagent aggregation, selected TUI session ID
  routing, natural-language assistant text analysis, and new Health enum values remain out of scope.

## 0.2.2

### Fixed

- Keep Health polling active independently of OpenCode render and event activity.
- Register refresh events through the supported OpenCode TUI `api.event.on` API.
- Prevent overlapping watcher executions with a single-flight refresh guard.
- Abort an in-flight watcher and remove timers/event handlers when the TUI plugin is disposed or reloaded.
- Show `Unknown` with `Health data is stale.` instead of retaining an outdated Health result.
- Update the already-mounted OpenTUI text nodes when Health polling changes, including second-level `Last Check` updates.

### Validation

- Added coverage for multi-cycle polling, transient failure recovery, stale data, single-flight behavior, disposal, reload cleanup, event unsubscription, and render failures.
- Revalidated detector behavior and npm install/doctor/uninstall flows.

### Known limitations

- The compact indicator is only available on a selected OpenCode session.
- Provider retry detection and OMO subagent Health are not included.
- Some direct TUI shell completions without an exit code can remain `Unknown`.
