# Official Export Import MVP

## Scope

This MVP adds a separate import path for official AI service exports without changing the extractor or evaluator.

Supported providers:

- ChatGPT
- Gemini
- Claude

The importer writes the same normalized JSONL format already used by the project:

```jsonl
{"type":"user_message","content":"..."}
{"type":"assistant_message","content":"..."}
{"type":"tool_call","content":"..."}
{"type":"tool_result","content":"..."}
{"type":"system_event","content":"..."}
```

The extractor continues to read normalized JSONL through the existing loader. Provider-specific parsing stays inside the importer.

## CLI

```powershell
python scripts/import_official_export.py `
  --provider chatgpt `
  --input path\to\chatgpt_export.zip `
  --output raw_data\chatgpt_export_sample.jsonl
```

```powershell
python scripts/import_official_export.py `
  --provider gemini `
  --input path\to\google_takeout.zip `
  --output raw_data\gemini_export_sample.jsonl
```

```powershell
python scripts/import_official_export.py `
  --provider claude `
  --input path\to\claude_export.zip `
  --output raw_data\claude_export_sample.jsonl
```

Optional selection:

```powershell
python scripts/import_official_export.py `
  --provider chatgpt `
  --input path\to\chatgpt_export.zip `
  --output raw_data\selected.jsonl `
  --conversation-index 3
```

```powershell
python scripts/import_official_export.py `
  --provider claude `
  --input path\to\claude_export.zip `
  --output raw_data\selected.jsonl `
  --conversation-id "conversation-uuid"
```

## Current implementation approach

This is intentionally not a full import architecture refactor.

The MVP adds:

- `src/session_state/official_export_importer.py`
- `scripts/import_official_export.py`
- importer tests using representative synthetic export archives

It does not modify:

- extractor
- evaluator
- health detector
- existing ChatGPT line-range ingestion

## ChatGPT support

Primary supported structure:

- official export archive containing `conversations.json`
- `conversations.json` is a list of conversations
- each conversation may contain ChatGPT's `mapping` tree
- the importer follows `current_node` back to the root and emits messages in order

Fallback supported structure:

- a conversation object with a message-like list such as `messages`

Role mapping:

- `user` -> `user_message`
- `assistant` -> `assistant_message`
- `system`, `developer` -> `system_event`
- `tool`, `function` -> `tool_result`

## Claude support

Claude support is best-effort until a real export sample is added to the repository.

The importer searches official export JSON files for conversation-like collections, preferring:

- `conversations.json`
- `chats.json`

It supports message-like lists such as:

- `messages`
- `chat_messages`
- `turns`
- `entries`
- `items`

Role mapping includes:

- `human`, `user` -> `user_message`
- `assistant`, `claude` -> `assistant_message`

Important limitation:

> Claude artifacts and project context are not normalized yet. The current MVP only extracts text-like conversation messages.

## Gemini support

Gemini support is best-effort until a real Google Takeout sample is added to the repository.

The importer searches JSON files inside the export archive, preferring:

- `conversations.json`
- `gemini.json`
- `MyActivity.json`
- `My Activity.json`

It supports message-like lists where roles look like:

- `user` -> `user_message`
- `model`, `gemini`, `assistant` -> `assistant_message`

Important limitation:

> Some Google Takeout exports may contain activity records rather than complete assistant responses. If the export contains only prompt/activity history, the importer may produce only user-side messages or fail to find a complete session.

## What still requires real export validation

The repository currently does not contain real ChatGPT, Gemini, or Claude official export archives.

Before treating this as a stable importer, validate with real sanitized exports:

1. ChatGPT export ZIP with `conversations.json`
2. Claude export ZIP from Settings > Privacy > Export data
3. Gemini Google Takeout archive with Gemini Apps data

For each provider, confirm:

- the expected JSON file names exist
- one conversation can be selected deterministically
- user/assistant order is preserved
- role mapping is correct
- long conversations are complete
- special blocks are handled or explicitly skipped
- resulting JSONL can be loaded by the existing extractor

## Design decision

No common adapter interface was introduced yet.

That is deliberate. The provider export shapes should be validated first. A common import interface should be extracted only after the three providers have been tested on real export archives.

