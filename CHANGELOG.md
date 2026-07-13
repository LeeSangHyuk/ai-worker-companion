# Changelog

## 0.2.2 - Unreleased

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
