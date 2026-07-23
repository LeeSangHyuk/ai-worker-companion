# Architecture

This document describes the AI Worker Companion architecture as of
`ai-worker-companion@0.2.7`.

The short version:

```text
Plugin is the View.
Watcher is the Health Brain.
OpenCode DB and logs are evidence sources.
Recovery remains human-directed.
```

## Current product shape

AWC is currently an OpenCode Health Companion. It is local-first and installed
with npm into the current user's OpenCode configuration.

It answers:

- Is the current OpenCode work idle, active, quiet, stuck, failed, or unknown?
- What evidence caused that label?
- Is the parent task idle while a child agent is still working?
- Is a provider/model retry loop preventing progress?
- Is the installed AWC package behind npm `latest`?

It is not:

- a hosted monitoring service
- an LLM provider
- an automatic recovery agent
- a general OMO controller
- a cross-platform notification service

## Runtime data flow

```text
User
  ↓
OpenCode
  ├─ opencode.db
  └─ ~/.local/share/opencode/log/*.log
         ↓
AWC Watcher
  ├─ session lifecycle evidence
  ├─ tool evidence
  ├─ provider retry evidence
  └─ direct parent/child aggregation
         ↓
Health JSON
         ↓
OpenCode Plugin
  ├─ TUI Sidebar / Compact Indicator
  └─ Desktop-safe background notification loop
```

## Runtime components

### CLI

Files:

```text
bin/awc.js
npm/cli/main.js
npm/cli/install.js
npm/cli/doctor.js
npm/cli/paths.js
npm/cli/files.js
```

Responsibilities:

- install AWC-managed files
- preserve existing OpenCode settings
- install runtime dependencies under the AWC runtime directory
- validate installation with `awc doctor`
- uninstall only AWC-managed files
- print the package version from `package.json`

The CLI copies runtime files from the npm package into user-level XDG paths.
It also centralizes external executable resolution in `npm/cli/paths.js` so
`npm`, `npm.cmd`, and `opencode` are handled consistently across platforms.
On Windows, the resolver accounts for `Path`/`PATH` casing differences, Windows
path delimiters, `PATHEXT`, `.cmd` shims, and paths containing spaces.

Common edit points:

| Task | Files |
|---|---|
| Change install/uninstall behavior | `npm/cli/install.js`, `npm/test/install.test.js` |
| Change doctor checks | `npm/cli/doctor.js`, `npm/test/doctor.test.js` |
| Change path, version, or executable resolution | `npm/cli/paths.js` |

### Plugin View

File:

```text
integrations/opencode/.opencode/plugins/agent-companion.js
```

TUI responsibilities:

- call the watcher approximately every five seconds
- keep polling alive independent of OpenCode render/event activity
- update mounted OpenTUI text nodes directly
- display:
  - `Overall`
  - `Parent`
  - `Children`
  - child detail rows, up to five
  - `Reason`
  - `Tool`
  - `Last Check`

The compact indicator shows Overall Health only.

Standard plugin responsibilities:

- start the notification controller when `AWC_NOTIFICATION_MODE` enables it
- reuse the same watcher and Health transition policy as the TUI surface
- avoid duplicate notification pollers across multiple OpenCode plugin contexts
  with an AWC-managed file lock
- log non-sensitive notification decisions with `client.app.log`
- check npm `latest` on a cached, best-effort basis and show an update toast
  when OpenCode exposes `api.ui.toast`

The plugin does not own Health policy. It renders watcher output in TUI mode and
uses the same output to drive opt-in notifications in Desktop/no-TUI mode.

### Desktop behavior

OpenCode Desktop loads the global AWC plugin from the same user-level plugin
directory as the TUI path. The Desktop app does not expose the OpenTUI sidebar
slots, so AWC Desktop support is intentionally background-only for now:

```text
OpenCode Desktop
  ↓
standard plugin lifecycle
  ↓
AWC notification controller
  ↓
DB/log watcher
  ↓
optional macOS notification
```

Desktop can load the plugin multiple times for different directories. AWC uses a
runtime lock file under the AWC data directory so only one notification
controller owns polling at a time. If the owner process disappears, the next
plugin instance can reclaim the stale lock.

Common edit points:

| Task | Files |
|---|---|
| Change sidebar or compact display | `integrations/opencode/.opencode/plugins/agent-companion.js` |
| Change polling/stale UI behavior | `npm/test/health-refresh.test.js` |
| Change notification mode or Desktop-safe polling | `integrations/opencode/.opencode/plugins/agent-companion.js`, `npm/test/health-refresh.test.js` |
| Change update checker behavior | `integrations/opencode/.opencode/plugins/agent-companion.js`, `npm/test/health-refresh.test.js` |
| Update user-facing display examples | `README.md`, `CHANGELOG.md` |

### DB Health Watcher

File:

```text
integrations/opencode/adapter/db_health_watcher.ts
```

Responsibilities:

- read OpenCode SQLite session and part rows
- evaluate latest session lifecycle activity
- evaluate latest tool state
- combine provider retry evidence
- climb from selected child to root parent when needed
- query direct child sessions via `session.parent_id`
- compute Overall Health from parent and included children
- emit stable Health JSON

The watcher is the current production runtime. It is TypeScript executed by
Node.js 24+.

Common edit points:

| Task | Files |
|---|---|
| Change Health policy | `integrations/opencode/adapter/db_health_watcher.ts` |
| Add watcher regression coverage | `npm/test/health-watcher.test.js` |
| Update documented Health rules | `docs/HEALTH_MODEL.md`, `CHANGELOG.md` |

### Provider Retry Parser

File:

```text
integrations/opencode/adapter/provider_retry_parser.js
```

Responsibilities:

- scan OpenCode logs for provider/model retry metadata
- extract non-sensitive fields such as provider, model, session ID, status code,
  retry delay, and retry sequence
- maintain a cursor so polling does not reread the whole log
- ignore retry evidence from other sessions
- allow newer DB activity to clear stale retry evidence

The parser does not output prompts, responses, tool output, or file contents.

Common edit points:

| Task | Files |
|---|---|
| Change retry parsing | `integrations/opencode/adapter/provider_retry_parser.js` |
| Add parser fixtures | `npm/test/provider-retry-fixtures/*.txt` |
| Add parser regression coverage | `npm/test/provider-retry-parser.test.js` |

## Source map

Current runtime files:

```text
bin/awc.js
npm/cli/main.js
npm/cli/install.js
npm/cli/doctor.js
npm/cli/files.js
npm/cli/paths.js
integrations/opencode/adapter/db_health_watcher.ts
integrations/opencode/adapter/provider_retry_parser.js
integrations/opencode/.opencode/plugins/agent-companion.js
```

Current test files:

```text
npm/test/health-watcher.test.js
npm/test/provider-retry-parser.test.js
npm/test/provider-retry-fixtures/*.txt
npm/test/health-refresh.test.js
npm/test/install.test.js
npm/test/doctor.test.js
npm/test/main.test.js
npm/test/opentui-node.integration.test.js
```

The OpenTUI node integration test may be skipped by Node when the local runtime
lacks FFI support. It is still useful when Bun/OpenTUI support is available.

## Health JSON shape

The watcher keeps backward-compatible top-level fields:

```text
health
reason
checked_at
session
tool
activity
provider_retry
thresholds
wal
```

0.2.5 adds optional Parent/Child fields:

```text
overall
parent
children_summary
children
```

Top-level `health` is Overall Health.

## Parent/Child model

OpenCode stores direct child sessions with:

```text
session.parent_id = parent session id
```

AWC v1 only uses direct children:

```text
Parent
├─ Child A
├─ Child B
└─ Child C
```

Nested child UI is intentionally deferred.

If the selected watcher session is itself a child, the watcher climbs to the
root parent and then evaluates that parent plus its direct children.

## Evidence order

The watcher considers evidence in this broad order:

```text
watcher freshness
provider retry
newer step error
running tool
unfinished step
newer session activity
completed tool
no activity
```

Within Overall aggregation:

```text
Failed → Stuck → Active → Quiet → Unknown → Idle
```

See [Health Model](HEALTH_MODEL.md) for the detailed rules.

## Current installed paths

Default paths:

```text
~/.local/share/awc/
  adapter/db_health_watcher.ts
  adapter/provider_retry_parser.js
  opencode/agent-companion.js

~/.config/opencode/
  tui-plugins/awc.js
  plugins/awc.js
  tui.json
```

These paths can vary through `HOME`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, and
`AWC_RUNTIME_DIR`.

## Design boundaries

AWC does not currently implement:

- selected TUI session routing with full reliability
- recursive/nested child UI
- OMO-specific aggregation
- natural-language assistant text analysis
- Windows/Linux native notifications
- notification history or mobile push
- multi-session aggregate monitoring across multiple concurrent OpenCode
  windows
- automatic recovery
- new Health enum values beyond `idle`, `active`, `quiet`, `stuck`, `failed`,
  and `unknown`

## Maintainer rules

- Keep Health policy in the watcher, not in the plugin view.
- Keep provider retry parsing metadata-only.
- Do not infer Health from assistant natural language as the primary signal.
- Do not let old child sessions pollute current Overall Health.
- Preserve `awc install`, `awc doctor`, and `awc uninstall` behavior.
- Re-run the release checks before publishing:

  ```bash
  npm test
  node --check integrations/opencode/adapter/db_health_watcher.ts
  node --check integrations/opencode/adapter/provider_retry_parser.js
  node --check integrations/opencode/.opencode/plugins/agent-companion.js
  git diff --check
  npm pack --dry-run
  ```

- When UI behavior changes, install a local tarball, run `awc doctor`, restart
  OpenCode, and manually verify the screen behavior.
