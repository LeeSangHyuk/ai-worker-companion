# Changelog

## 0.2.7

### Added

- Add an in-plugin update checker for `ai-worker-companion` that compares the
  installed version with the npm `latest` version.
- Show a best-effort OpenCode toast when a newer AWC version is available,
  including the install command and restart guidance.
- Add update-check caching so the registry is not queried on every plugin load.
- Add CLI version output through `awc version`, `awc --version`, and `awc -v`.

### Changed

- Bump the npm package and installed runtime metadata to `0.2.7`.
- Improve Windows command resolution by using Windows path delimiters, honoring
  `Path`/`PATH` casing differences, and preferring `PATHEXT` executable shims.
- Keep update checks isolated from Health polling so registry/network failures
  do not affect Health display or notifications.
- Continue using the shared executable resolver for `npm`, `npm.cmd`, and
  `opencode` across install and doctor flows.

### Fixed

- Fix Windows cases where `doctor` could report `OpenCode (not found)` even
  when `opencode --version` worked in the user's shell.
- Fix Windows `.cmd` shim execution for paths with spaces without enabling
  `shell: true` globally.
- Fix stale `PATH` vs `Path` handling on Windows by checking all relevant
  environment key variants.
- Fix command lookup order so Windows `PATHEXT` candidates are preferred over
  extensionless shadow files.

### Validation

- Added tests for Windows `Path`/`PATH` casing, stale `PATH`, `PATHEXT` lookup,
  `.cmd` shim execution, paths containing spaces, native fallback behavior, and
  update checker cache/failure behavior.
- Revalidated npm tests and package dry-run before release.

### Known limitations

- Windows native notifications are not included in this release.
- Desktop UI surfaces are still not available; OpenCode Desktop support remains
  background/notification focused.
- Multi-session aggregate monitoring across multiple concurrent OpenCode
  windows is not yet supported.
- Update checks are best-effort and depend on npm registry reachability.

## 0.2.6

### Added

- Add experimental OpenCode Desktop background support through the standard
  OpenCode plugin lifecycle.
- Add opt-in native macOS desktop notifications for Health transitions.
- Add notification modes:
  - `off`
  - `problems-only`
  - `all`
- Reuse the notification runtime across Desktop and TUI plugin contexts while
  keeping TUI rendering notification-free.

### Changed

- Share notification transition selection and watcher refresh behavior across
  Desktop/no-TUI and TUI environments.
- Manage notification polling ownership with an AWC-managed global lock file to
  prevent duplicate polling when OpenCode Desktop loads the plugin in multiple
  contexts.
- Improve notification runtime lifecycle handling so restart, disposal, and
  duplicate-controller cases are handled predictably.
- Improve executable resolution for npm/OpenCode commands, including Windows
  command shim handling.
- Log non-sensitive notification selection decisions through OpenCode app logs
  for Desktop verification.

### Fixed

- Avoid duplicate notifications from multiple OpenCode Desktop plugin contexts.
- Avoid notification runtime restart conflicts when plugin contexts reload.
- Avoid Desktop polling ownership conflicts by allowing only one notification
  owner at a time.
- Preserve Health polling when notification delivery fails.
- Improve provider retry notification selection so retry-driven `Stuck` evidence
  can notify in problem-focused modes.
- Fix Windows executable resolution cases where `.cmd` command shims should be
  invoked without enabling `shell: true` globally.

### Validation

- Verified macOS OpenCode Desktop `1.18.4` loads the global AWC plugin from the
  user OpenCode plugin directory.
- Verified Desktop and TUI processes use the same local OpenCode DB evidence.
- Verified Desktop fixture polling produces a single watcher stream and selects
  one completion notification on an `Active` to `Idle` transition.
- Verified direct notifier execution calls macOS `osascript` with sanitized
  notification text.
- Verified notification mode behavior, legacy `AWC_NOTIFICATION_ENABLED=1`
  compatibility, notifier failure isolation, lock ownership, stale lock recovery,
  and Windows command resolution with automated tests.

### Known limitations

- Desktop monitors the selected/latest session tree only; aggregate monitoring
  across multiple concurrent sessions is not yet supported.
- OpenCode Desktop `1.18.4` does not expose a plugin UI API for Sidebar, Panel,
  View, WebView, Status bar, or Toolbar surfaces.
- AWC Sidebar and Compact Indicator are available only in the OpenCode TUI.
- Desktop support is background-only and notification-focused.
- Native notifications are currently macOS-focused and opt-in.
- Windows/Linux native notifications, notification history, mobile push,
  selected TUI session routing, and OMO-specific integration remain out of
  scope.

## 0.2.5

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
