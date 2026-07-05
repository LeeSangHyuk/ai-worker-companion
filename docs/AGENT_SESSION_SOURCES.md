# Agent Session Sources Research

## Purpose

This document investigates whether AI coding agent sessions can be imported into the same Representation Pipeline used by the current project.

Targets:

- Codex Desktop / Codex codebase
- Claude Code
- OpenCode

This is research only. No importer implementation is implied.

## Evidence policy

The findings below separate:

- **Confirmed**: directly supported by official docs or public source code.
- **Observed locally**: confirmed only on the current machine without reading private transcript contents.
- **Inference**: likely implication from confirmed behavior, but not a documented contract.
- **Unknown**: not confirmed from available public docs/source.

Internal storage formats should be treated as unstable unless explicitly documented as an export or API contract.

## Summary table

| 서비스 | 공식 Export | 로컬 세션 | 저장 위치 | 파일 형식 | Tool Call 포함 | Import 가능성 | 근거 |
|---|---|---|---|---|---|---|---|
| Codex Desktop / Codex | 확인된 사용자용 official export는 없음 | 있음 | `codex_home/sessions/YYYY/MM/DD/rollout-<timestamp>-<id>.jsonl`; 일반적으로 `~/.codex/sessions/...`로 예시됨 | JSONL rollout | 높음. `RolloutItem`에 `ResponseItem`, `EventMsg`, session metadata 등이 저장됨 | 높음. 현재 프로젝트의 기존 `codex_log.py`가 이미 유사한 JSONL을 읽음 | OpenAI Codex public source: `codex-rs/rollout` |
| Claude Code | 확인된 사용자용 official export는 없음 | 있음 | 공식 hook docs 예시는 `~/.claude/projects/.../<session>.jsonl`; Windows의 `~/.claude`는 `%USERPROFILE%\.claude` | JSONL transcript | 미확인. transcript가 있고 resume 가능하지만, local transcript schema와 tool record 포함 범위는 공식 docs에서 안정 계약으로 설명되지 않음 | 중간. transcript path가 공식 hook input으로 노출되므로 접근 경로는 현실적이나 schema 검증 필요 | Claude Code docs: CLI reference, hooks reference, settings |
| OpenCode | 확인된 official export는 없음. share 기능은 별도 | 있음 | public source 기준 `Global.Path.data/opencode.db`; `Global.Path.data = xdgData/opencode`; channel에 따라 `opencode.db` 또는 `opencode-<channel>.db` | SQLite | 높음. schema에 `SessionMessage`, `Shell`, `AssistantTool`, tool state, message/part tables 존재 | 높음. SQLite adapter 필요. 단, DB schema는 내부 구현으로 취급해야 함 | OpenCode public source: `packages/core/src/global.ts`, `database.ts`, `session/sql.ts`, `schema/session-message.ts` |

## Codex Desktop / Codex

### 1. 세션이 로컬에 저장되는가?

**Confirmed.**

OpenAI Codex public source has a rollout persistence layer for session files. The `codex-rs/rollout/src/recorder.rs` file describes persisted Codex session rollouts as JSONL and gives examples using `~/.codex/sessions/rollout-...jsonl`.

Source:

- [openai/codex `codex-rs/rollout/src/recorder.rs`](https://github.com/openai/codex/blob/main/codex-rs/rollout/src/recorder.rs)
- [openai/codex `codex-rs/rollout/src/lib.rs`](https://github.com/openai/codex/blob/main/codex-rs/rollout/src/lib.rs)

### 2. 기본 저장 위치는 어디인가?

**Confirmed from source code.**

The rollout recorder computes:

```text
codex_home / sessions / YYYY / MM / DD / rollout-YYYY-MM-DDThh-mm-ss-<conversation_id>.jsonl
```

The code comment explicitly describes the directory layout as:

```text
~/.codex/sessions/YYYY/MM/DD/rollout-YYYY-MM-DDThh-mm-ss-<uuid>.jsonl
```

Important nuance:

- `~/.codex` is the common/default-style home shown in source comments.
- The actual root is `codex_home`, which can be configured by the application/runtime.

### 3. 파일 형식은 무엇인가?

**Confirmed.**

JSONL.

The rollout recorder states that rollouts are recorded as JSONL and can be inspected with tools such as `jq` or `fx`.

Each line is a serialized `RolloutLine` containing a `RolloutItem`.

### 4. 대화 전체를 복원할 수 있는가?

**Confirmed for Codex’s own runtime.**

The source includes rollout loading/resume logic and thread listing over rollout files. It reads rollout items back to resume history.

For this project, the relevant interpretation is:

> Codex rollout JSONL is a local session source that can be normalized into this project’s `user_message`, `assistant_message`, `tool_call`, `tool_result`, and `system_event` records.

### 5. Tool Call, Command, Output까지 포함되어 있는가?

**Confirmed at the event-family level.**

The rollout persistence layer stores `RolloutItem`s including response items and event messages. The current project already supports Codex-like records such as:

- `response_item.message`
- `response_item.function_call`
- `response_item.function_call_output`
- `response_item.custom_tool_call`
- `response_item.custom_tool_call_output`
- `event_msg`

This means Codex is the closest source to the project’s current normalized event model.

### 6. 공식적으로 지원되는 방식인가, 내부 구현인가?

**Internal implementation, not an official export.**

The storage exists in public source and powers session persistence/resume, but this is not the same as a documented user-facing export contract.

Treat as:

> Local Session source, internal schema.

### 7. Import Adapter를 만드는 것이 현실적으로 가능한가?

**High feasibility.**

Reasons:

- local JSONL
- event stream already close to current loader
- tool calls/results can be represented
- session metadata provides cwd/source/thread info

Risk:

- rollout schema can change across Codex versions
- compressed rollouts may need handling if compression is enabled
- archived sessions live under a separate archived sessions directory

### 8. 프로젝트에서 어떤 입력(Source)으로 취급하는 것이 적절한가?

Recommended source type:

> Local Session

Not Official Export.

## Claude Code

### 1. 세션이 로컬에 저장되는가?

**Confirmed.**

Claude Code official CLI reference says:

- `claude --continue` continues the most recent conversation.
- `claude --resume` resumes a specific session by ID or name.
- `claude rm <id>` removes a background session from the list, while the conversation transcript stays on the local machine and remains available through `claude --resume`.
- `claude project purge` deletes local project state including transcripts.

Source:

- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference)

### 2. 기본 저장 위치는 어디인가?

**Partially confirmed.**

Claude Code hook documentation includes hook input examples with:

```text
transcript_path: /Users/.../.claude/projects/.../<session-id>.jsonl
```

and subagent examples:

```text
~/.claude/projects/.../<session-id>/subagents/agent-<id>.jsonl
```

Claude Code settings docs also state that on Windows, paths shown as `~/.claude` resolve to:

```text
%USERPROFILE%\.claude
```

Source:

- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- [Claude Code settings](https://code.claude.com/docs/en/settings)

Observed locally:

- This machine has `%USERPROFILE%\.claude`
- This machine has `%USERPROFILE%\.claude.json`

No private transcript contents were inspected.

### 3. 파일 형식은 무엇인가?

**Confirmed by official hook examples as path extension.**

JSONL transcript files are referenced in official hook input examples.

However:

> The exact transcript line schema is not documented as a stable public import/export contract in the docs reviewed.

### 4. 대화 전체를 복원할 수 있는가?

**Confirmed for Claude Code’s own runtime.**

`--continue`, `--resume`, and `rm` behavior imply persisted conversation transcripts are sufficient for Claude Code to resume conversations.

For third-party import:

> Likely possible, but requires validation against real transcript files.

### 5. Tool Call, Command, Output까지 포함되어 있는가?

**Unknown from official docs.**

Claude Code docs confirm:

- transcripts exist
- transcript paths are exposed to hooks
- background sessions and subagent transcripts exist
- hooks receive rich event inputs

But the reviewed docs do not define the transcript JSONL record schema or guarantee exactly which tool calls, command inputs, command outputs, hook events, and permission events are present in the local transcript.

Therefore:

> Do not claim tool-call coverage until a real transcript is inspected and mapped.

### 6. 공식적으로 지원되는 방식인가, 내부 구현인가?

Mixed:

- The existence of local transcripts and `transcript_path` is officially documented.
- The transcript file schema should be treated as internal/undocumented.

Treat as:

> Local Session source with official path exposure, but internal schema.

### 7. Import Adapter를 만드는 것이 현실적으로 가능한가?

**Medium feasibility.**

Positive signals:

- transcript path is explicitly exposed
- files are JSONL
- resume workflow depends on persisted transcripts

Risks:

- schema is not documented as stable
- tool call/output coverage must be verified
- subagents use separate nested transcript files
- background sessions may have supervisor state beyond a single transcript

### 8. 프로젝트에서 어떤 입력(Source)으로 취급하는 것이 적절한가?

Recommended source type:

> Local Session

Not Official Export.

Secondary source possibility:

> Stream JSON output from non-interactive Claude Code runs

Claude Code supports `--output-format stream-json` in print mode. That may be more stable for scripted collection, but it is not the same as importing existing interactive local sessions.

## OpenCode

### Which OpenCode?

This section focuses on the current `opencode.ai` public repository:

- [anomalyco/opencode](https://github.com/anomalyco/opencode)

There is also an older/different repository:

- [opencode-ai/opencode](https://github.com/opencode-ai/opencode)

The current project direction should target the active `opencode.ai` codebase unless a user explicitly provides data from the older Go implementation.

### 1. 세션이 로컬에 저장되는가?

**Confirmed.**

OpenCode README states:

- Session Management: save and manage multiple conversation sessions.
- Persistent Storage: SQLite database for storing conversations and sessions.

Source:

- [OpenCode README](https://github.com/anomalyco/opencode)

### 2. 기본 저장 위치는 어디인가?

**Confirmed from source code.**

OpenCode source defines:

```ts
const app = "opencode"
const data = path.join(xdgData!, app)
```

The database path is:

```ts
Global.Path.data / "opencode.db"
```

or, for non-default channels:

```ts
Global.Path.data / `opencode-<channel>.db`
```

There is also an override:

```text
OPENCODE_DB
```

If `OPENCODE_DB` is absolute or `:memory:`, it is used directly. If relative, it is joined with `Global.Path.data`.

Source:

- `packages/core/src/global.ts`
- `packages/core/src/database/database.ts`

### 3. 파일 형식은 무엇인가?

**Confirmed.**

SQLite database.

OpenCode uses Drizzle with SQLite and creates tables including:

- `session`
- `message`
- `part`
- `session_message`
- `session_input`
- `todo`
- `session_context_epoch`

Source:

- `packages/core/src/session/sql.ts`
- `packages/core/src/database/database.ts`

### 4. 대화 전체를 복원할 수 있는가?

**Confirmed for OpenCode’s own runtime.**

OpenCode has a `SessionStore` that loads session context from database-backed session message history.

For this project:

> The session can likely be reconstructed by querying session/message/part tables, but the correct projection should follow OpenCode’s own schema rather than scraping UI.

### 5. Tool Call, Command, Output까지 포함되어 있는가?

**Confirmed from schema.**

OpenCode session message schema includes:

- `User`
- `Assistant`
- `System`
- `Shell`
- `AssistantTool`
- tool states: `pending`, `running`, `completed`, `error`
- tool input
- tool content/output
- structured output
- errors

Source:

- `packages/schema/src/session-message.ts`
- `packages/core/src/session/sql.ts`

### 6. 공식적으로 지원되는 방식인가, 내부 구현인가?

**Internal implementation.**

The public source and README confirm SQLite persistent storage, but this is not an official export format.

Treat as:

> Local Session source, internal SQLite schema.

### 7. Import Adapter를 만드는 것이 현실적으로 가능한가?

**High feasibility.**

Reasons:

- structured SQLite DB
- explicit session/message/part tables
- tool calls and shell messages are typed
- session IDs and timestamps exist

Risks:

- schema can migrate
- DB may be locked while OpenCode is running
- adapter needs SQL joins and version-aware decoding
- tool output may be pruned or stored separately depending on configuration

### 8. 프로젝트에서 어떤 입력(Source)으로 취급하는 것이 적절한가?

Recommended source type:

> Local Session

Not Official Export.

Shared Link may become a separate source later if OpenCode share data is more stable than the local DB, but current evidence points to SQLite local session as the most direct source.

## Key comparison: consumer chat exports vs coding-agent sessions

ChatGPT / Claude / Gemini official exports are best modeled as:

> Official Export sources

They are user-requested archives or Takeout-like bundles. The importer should expect batch exports, conversation selection, and provider-specific archive structures.

Coding agents are different. Codex, Claude Code, and OpenCode primarily expose:

> Local Session sources

They are not export archives. They are local persistence stores used by the tools themselves for resume, history, background sessions, and UI state.

This changes the import strategy:

| Dimension | ChatGPT / Claude / Gemini web apps | Coding Agents |
|---|---|---|
| Primary source | Official export archive | Local session store |
| User action | Download/export data | Point importer at local session path/store |
| Format | ZIP/TGZ/JSON/HTML-like exports | JSONL rollout/transcript or SQLite |
| Stability | Official export exists, but schema may still vary | Often internal implementation |
| Tool calls | Usually absent or limited | Central to the value |
| Privacy risk | Full account export | Local project/session data, command output, file paths |
| Adapter style | Archive parser | Local store reader |

## What should be supported first?

Recommended priority:

1. **Codex local rollout JSONL**
2. **Claude Code local transcript JSONL**
3. **OpenCode SQLite**

Reasoning:

### 1. Codex local rollout JSONL should come first

It is closest to the project’s current loader and normalized event model.

The project already reads Codex-like JSONL records:

- response items
- function/tool calls
- function/tool outputs
- event messages

This gives the highest chance of useful imported sessions with the smallest adapter risk.

### 2. Claude Code transcript JSONL should come second

Claude Code has official docs exposing `transcript_path`, and JSONL is a friendly import shape. However, the transcript schema and tool-call coverage must be validated before claiming robust support.

### 3. OpenCode SQLite should come third

OpenCode likely has the richest structured data, including shell and tool state. But SQLite import requires schema-aware joins, DB lock handling, and version handling. It is highly valuable but heavier than JSONL adapters.

## Does the Import Adapter architecture need to change now?

Not yet.

The current project principle still holds:

> Provider/source-specific mess stays inside importer code. The extractor and evaluator consume normalized JSONL only.

The architecture can remain:

```text
Source-specific importer
    -> Normalized JSONL
        -> Existing loader
            -> Extractor
            -> Evaluator
```

However, the source taxonomy should be updated conceptually:

```text
Official Export
  - ChatGPT export ZIP
  - Claude web export ZIP
  - Gemini Takeout

Local Session
  - Codex rollout JSONL
  - Claude Code transcript JSONL
  - OpenCode SQLite

Shared Link
  - ChatGPT shared link
  - Gemini shared link
  - OpenCode share page, if later validated

Generated Stream
  - Claude Code --output-format stream-json
  - future scripted agent runs
```

No shared adapter abstraction should be introduced yet. The inputs differ too much:

- ZIP archive parser
- JSONL transcript parser
- SQLite store reader
- stream-json collector

Instead, add adapters one at a time and extract common interfaces only after at least three real local-session sources are validated.

## Open questions for validation

### Codex

- Are rollouts compressed in some environments?
- Are Desktop and CLI rollout records identical enough for one adapter?
- How should archived sessions be discovered?
- Which `RolloutItem` variants should map to `system_event` rather than user/assistant/tool?

### Claude Code

- What is the exact JSONL transcript record schema?
- Are Bash/Read/Edit/Write tool calls stored as separate records?
- Are command outputs stored fully or truncated?
- How are background agents and subagents linked to the main transcript?
- Does `claude project purge --dry-run` reveal transcript paths without reading contents?

### OpenCode

- Which DB schema version is currently installed for typical users?
- What queries best reconstruct a full timeline?
- Are `SessionMessageTable` or legacy `MessageTable`/`PartTable` the preferred source?
- How are tool outputs pruned or stored externally?
- Can the DB be read safely while OpenCode is running?

