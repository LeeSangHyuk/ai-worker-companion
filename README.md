# AI Worker Companion

AI workers shouldn't fail silently.

AI Worker Companion is an agent-agnostic layer for understanding, monitoring, and recovering long-running AI agent sessions. It turns session state into a readable status, calls attention to possible blockers, and prepares a human-approved handoff prompt when work needs to continue elsewhere.

```text
AI Agent Session
  -> Session State
  -> Companion Status
  -> Human Attention
  -> Recovery Handoff
```

## What this is

This project is an MVP PoC for an AI Worker Companion.

It helps a human answer:

- What is the AI agent currently trying to do?
- What is the current situation?
- Is anything blocking progress?
- What evidence supports that state?
- How can I resume or hand off this session without rereading the whole log?

The current implementation is local-first and agent-agnostic. OpenCode is the first integration experiment, not the product boundary.

## What this is not

This is not:

- an AI IDE
- an LLM provider or hosted model service
- a full observability platform
- an OpenCode-only tool
- a production-ready supervision system
- an automatic recovery agent

Recovery is handoff-only. Nothing starts a new session automatically.

## What works today

- Read existing session representation JSON.
- Print session state from a CLI.
- Print a recovery/handoff prompt from a CLI.
- Open a static Companion mock in the browser.
- Use notification/recovery/state seams inside the Companion mock.
- Inspect an OpenCode integration PoC skeleton.

Current product path:

```text
Core Engine
  -> Agent Adapter
  -> Companion
  -> Notification
  -> Recovery
```

## Quick Start

### OpenCode Companion (npm package)

Requires Node.js 24 or newer. After the package is published, install AWC into
your user-level OpenCode configuration with:

```bash
npx ai-worker-companion install
npx ai-worker-companion doctor
```

The installer preserves existing OpenCode plugins, including
`oh-my-openagent`, and installs the Health Detector and TUI view into the
current user's XDG configuration and data directories. To remove only files
and settings managed by AWC:

```bash
npx ai-worker-companion uninstall
```

Known v0.2 limitations:

- The compact indicator appears on a selected OpenCode session, not the home screen.
- A direct TUI shell command may be reported as `Unknown` when OpenCode records no exit code.
- The Python Health Detector remains in the repository as a reference implementation; the npm runtime uses TypeScript.

### Repository development

#### 1. Install locally

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e .
```

#### 2. Print session state

Use the public sanitized example:

```powershell
python session_state.py `
  --input examples/session.state.example.json `
  --format markdown
```

Or read a local folder of generated representations if you have created one:

```powershell
python session_state.py `
  --input outputs/representations_full_124_gemini_3_1_flash_lite `
  --select recent `
  --format markdown
```

#### 3. Generate a handoff prompt

```powershell
python session_state.py `
  --input examples/session.state.example.json `
  --resume
```

The handoff prompt is printed to stdout. It is meant to be copied by a human into another agent session.

#### 4. Open the Companion mock

Open this file in a browser:

```text
companion/index.html
```

The mock demonstrates the intended UX:

```text
quiet status -> attention -> recovery handoff
```

#### 5. Inspect the OpenCode PoC

OpenCode is the first integration target.

```text
integrations/opencode/
```

Important files:

- `integrations/opencode/adapter/session_state_adapter.py`
- `integrations/opencode/.opencode/commands/companion-state.md`
- `integrations/opencode/.opencode/commands/companion-handoff.md`
- `integrations/opencode/.opencode/plugins/agent-companion.js`

The current OpenCode PoC focuses on proving the adapter path:

```text
OpenCode
  -> Adapter
  -> session_state.py
  -> Companion state / handoff output
```

## Repository Structure

```text
src/session_state/
  Core engine modules:
  schema, extractor, prompt, importers, health checks

session_state.py
  Agent-facing CLI for state and handoff output

companion/
  Static AI Worker Companion mock
  state / notification / recovery seams

integrations/
  Agent adapter experiments
  currently: OpenCode PoC

scripts/
  Import, evaluation, viewer, and validation utilities

tests/
  CLI, importer, and ingestion tests

samples/
  Small sample sessions and health detector fixtures

raw_data/
  Research fixtures and validation samples

outputs/
reports/
reviews/
viewer/
  Generated validation and prototype artifacts

docs/
  Architecture, validation, platform fit, and product direction notes
```

## Privacy and Local-First Principles

- No hosted LLM is provided by this project.
- No automatic cloud upload is performed by the Companion or CLI.
- `session_state.py` reads local representation JSON.
- Recovery does not automatically start a new agent session.
- Handoff is human-approved and copy/paste based.
- Generated outputs may contain sensitive session content; review before publishing.

Some extractor and batch workflows can call external model APIs when explicitly configured. The Companion, Core CLI state rendering, and OpenCode adapter path do not require a new hosted service.

## Project Status

Prototype / MVP PoC.

Validated so far:

- Session representation structure
- CLI session state rendering
- Recovery handoff prompt generation
- Static Companion UX mock
- OpenCode adapter direction

Not production-ready:

- persistent agent UI integration
- automatic supervision
- production notification routing
- multi-agent platform support
- privacy hardening for public datasets

## Key Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Project Vision](docs/PROJECT_VISION.md)
- [Repository Review](docs/REPOSITORY_REVIEW.md)
- [Companion Platform Fit](docs/COMPANION_PLATFORM_FIT.md)
- [OpenCode PoC](docs/OPENCODE_POC.md)
- [Plugin PoC](docs/PLUGIN_POC.md)

## Product Definition

AI Worker Companion helps humans understand, monitor, and recover long-running AI agent sessions without rereading the raw log.
