# Changelog

## 0.2.3 - Unreleased

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
