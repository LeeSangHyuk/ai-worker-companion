# AI Worker Companion

AI workers should not fail silently.

> **Early Preview:** AWC is an experimental local companion for OpenCode. Health
> labels are best-effort interpretations of local OpenCode DB and log evidence.
> They are meant to improve visibility, not to replace human judgment.

AI Worker Companion shows whether an OpenCode task appears idle, active, quiet,
stuck, failed, or unknown. It also explains the evidence behind the label so a
human can decide whether to wait, inspect logs, or intervene.

## Why AWC

AI coding agents can look busy while they are actually blocked, retrying a
provider call, waiting in a child task, or already finished. AWC makes that
hidden work state visible. It reads local OpenCode evidence, summarizes Health,
and shows why the status was chosen. The current product focuses on OpenCode
tasks, provider/model retry, and parent/child agent visibility. Long term, AWC
is intended to become a practical control-room layer for AI work: not an
automatic recovery agent, but a clear signal that helps humans decide when to
wait, inspect, or step in.

```text
OpenCode DB + OpenCode logs
  -> AWC Health Watcher
  -> Health JSON
  -> OpenCode plugin
  -> TUI sidebar / compact indicator, or Desktop background notification loop
```

## What works in 0.2.6

- Local npm CLI: `awc install`, `awc doctor`, `awc uninstall`.
- OpenCode TUI Health surface with `Overall`, `Parent`, `Children`, `Reason`,
  `Tool`, and `Last Check`.
- OpenCode Desktop background monitoring through the standard plugin lifecycle.
- Opt-in native macOS desktop notifications for Health transitions.
- Notification modes:
  - `off`
  - `problems-only`
  - `all`
- Polling that continues independently from OpenCode render/event activity.
- Mounted OpenTUI text nodes update in place, so the screen reflects each check.
- Stale watcher data becomes `Unknown` instead of preserving an old result.
- Session lifecycle-aware Health:
  - newer `step-finish reason=error` can become `Failed`
  - unfinished steps become `Active`, `Quiet`, or `Stuck`
  - newer session activity is not hidden by an older completed tool
- Provider/model retry detection from local OpenCode logs:
  - short same-session retry sequences become `Quiet`
  - repeated or long-running same-session retries become `Stuck`
  - newer same-session DB activity clears retry evidence
- Parent/Child Health Visibility v1:
  - top-level Health is `Overall`
  - parent Health is shown separately
  - direct child sessions are evaluated individually
  - old child sessions are excluded so stale failures do not pollute current work
  - compact indicator shows Overall only

## Install

Requires Node.js 24 or newer.

```bash
npx ai-worker-companion@latest install
npx ai-worker-companion@latest doctor
```

Check the installed package version:

```bash
npx ai-worker-companion@latest version
npx ai-worker-companion@latest --version
npx ai-worker-companion@latest -v
```

The installer writes only AWC-managed files under the current user's XDG
configuration and data directories. It preserves existing OpenCode settings and
plugins.

To remove AWC-managed files:

```bash
npx ai-worker-companion@latest uninstall
```

`awc doctor` prints environment details first, then installation checks:

```text
AI Worker Companion Doctor

AWC      : 0.2.6
Node     : v24.x.x
Platform : darwin-arm64
OpenCode : 1.x.x
Runtime  : ~/.local/share/awc
Plugin   : ~/.local/share/awc/opencode/agent-companion.js
```

On Windows, AWC resolves npm/OpenCode executables through a shared command
resolver. It prefers `npm_execpath` when npm provides it and handles `.cmd`
wrappers without enabling `shell: true` globally.

## What you should see

After install, restart OpenCode:

```bash
opencode .
```

In the sidebar, AWC displays:

```text
Overall: Active
Parent: Idle
Children: 1 active, 1 failed
- explore: Active
- test-agent: Failed
Reason: Child test-agent is failed: ...
Tool: bash · completed · exit 1
Last Check: 9:41:05 PM
```

If there are no direct child sessions:

```text
Overall: Idle
Parent: Idle
Children: none
```

## Notifications

AWC supports opt-in native macOS notifications. Notifications are disabled unless
you explicitly select a mode.

```bash
AWC_NOTIFICATION_MODE=problems-only opencode .
```

Modes:

- `off`: disable all AWC notifications.
- `problems-only`: notify only when work becomes `Stuck`, enters provider retry
  `Stuck`, or becomes `Failed`.
- `all`: include normal completion notifications in addition to problem
  notifications.

Legacy opt-in is preserved: if `AWC_NOTIFICATION_MODE` is not set and
`AWC_NOTIFICATION_ENABLED=1`, AWC treats it as `all`.

## OpenCode Desktop support

AWC supports the macOS OpenCode Desktop app as a background companion.

Desktop support includes:

- OpenCode Desktop loads the same global AWC plugin installed by `awc install`.
- Desktop and TUI use the same local OpenCode DB and log evidence.
- The same watcher and notification transition logic can run without the TUI
  sidebar.
- A file lock keeps only one notification poller active when Desktop loads the
  plugin in multiple project contexts.

Current Desktop behavior:

- Desktop does not show the AWC sidebar or compact indicator.
- AWC can still poll Health in the background and select macOS notifications
  when `AWC_NOTIFICATION_MODE` is enabled.
- If launched from Finder, Desktop may not inherit shell environment variables.
  For explicit notification mode testing, launch it from a terminal with the
  desired environment.

### TUI vs Desktop surfaces

| Surface | Supported behavior |
|---|---|
| OpenCode TUI | Sidebar, Compact Indicator, background polling, optional notifications |
| OpenCode Desktop | Background polling and optional native macOS notifications |

OpenCode Desktop `1.18.4` does not currently expose a plugin API for inserting
AWC UI into the app. Desktop Sidebar, Panel, View, WebView, Status bar, and
Toolbar surfaces are therefore not supported by AWC.

## Health states

| Health | Meaning | Typical action |
|---|---|---|
| `Idle` | No active evidence; work appears complete or inactive. | Usually wait or start next task. |
| `Active` | A tool, step, or child session is currently active. | Wait. |
| `Quiet` | Activity/retry is ongoing but has been quiet for a while. | Watch briefly. |
| `Stuck` | Running work or provider retry has exceeded the stuck threshold. | Inspect and consider intervention. |
| `Failed` | A structural failure was observed, such as a failed tool or error step. | Inspect evidence. |
| `Unknown` | AWC cannot make a reliable judgment, or watcher data is stale. | Check AWC/OpenCode state. |

AWC does not use assistant natural-language claims like “I am working” as the
primary signal. Health is based on structured local evidence.

## Known limitations

- Selected TUI session routing is still limited; the watcher currently follows
  its selected/latest session policy rather than a fully reliable TUI-selected
  session signal.
- Only direct child sessions are surfaced; recursive/nested child UI is not
  included.
- OMO-specific active agent/job board integration is not included.
- Desktop monitors the selected/latest session tree only. Aggregate monitoring
  across multiple concurrent sessions is not yet supported.
- OpenCode Desktop support is background-only. The AWC Sidebar and Compact
  Indicator are available only in the OpenCode TUI because Desktop does not
  currently expose a plugin UI API.
- Native notifications are macOS-focused and opt-in; Windows/Linux native
  notifications, mobile push, and notification history are not included.
- Natural-language assistant text analysis is not included.
- A direct TUI shell command may remain `Unknown` if OpenCode records no exit
  code.
- AWC is local visibility tooling, not proof that an external provider is making
  progress.

## Repository map

Current npm runtime:

```text
bin/awc.js
npm/cli/
integrations/opencode/adapter/db_health_watcher.ts
integrations/opencode/adapter/provider_retry_parser.js
integrations/opencode/.opencode/plugins/agent-companion.js
```

Tests:

```text
npm/test/
```

Docs:

```text
docs/ARCHITECTURE.md
docs/HEALTH_MODEL.md
```

## Development

Run the current JavaScript test suite:

```bash
npm test
```

Run syntax and packaging checks before a release:

```bash
node --check integrations/opencode/adapter/db_health_watcher.ts
node --check integrations/opencode/adapter/provider_retry_parser.js
node --check integrations/opencode/.opencode/plugins/agent-companion.js
git diff --check
```

Check package contents:

```bash
npm pack --dry-run
```

The package should contain only runtime files, README, LICENSE, and
`package.json`.

When UI behavior changes, also install a local tarball, run `awc doctor`,
restart OpenCode, and verify `Last Check`, Active/Idle transitions, and any
changed Health evidence manually.

## Privacy and local-first principles

- AWC reads local OpenCode DB and log files.
- AWC does not upload session content.
- Provider retry parsing extracts only retry metadata.
- Prompt, response, tool output, and file contents are not emitted as telemetry.
- Recovery remains human-directed; AWC does not start a new agent session.

## Key docs

- [Architecture](docs/ARCHITECTURE.md)
- [Health Model](docs/HEALTH_MODEL.md)
