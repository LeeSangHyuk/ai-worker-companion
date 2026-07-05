# Import Validation Checklist

## Purpose

This document defines how to validate the current Import MVP against real official export files.

The goal is **not** to claim full support for ChatGPT, Claude, or Gemini exports yet. The goal is to record, objectively and repeatably, how far the current importer works when given real export archives.

Current status:

- ChatGPT: MVP supports the commonly observed `conversations.json` export shape, including mapping-tree conversations.
- Claude: best-effort support only. Real official export compatibility is not yet verified.
- Gemini: best-effort support only. Real Google Takeout compatibility is not yet verified.

No new importer features should be added during validation. First record what works and what fails.

## Safety and privacy rules

Official exports can contain sensitive data.

Before using any export file:

1. Do not commit raw export ZIP/TGZ files.
2. Do not commit unredacted normalized JSONL generated from private conversations.
3. Prefer testing with a small export account or sanitized account.
4. If possible, create a test conversation specifically for importer validation.
5. Remove API keys, passwords, names, emails, phone numbers, customer data, medical data, legal data, company secrets, and private code before sharing outputs.
6. Store temporary exports outside version control.
7. If a sanitized fixture is later added to the repository, document how it was sanitized.

Recommended local folders:

```powershell
mkdir local_exports
mkdir local_import_outputs
```

Add these folders to local ignore rules if needed. They should not be treated as project fixtures unless explicitly sanitized.

## General validation flow

For each provider:

1. Obtain a real official export archive.
2. Place it in a local-only folder such as `local_exports`.
3. Run the importer for one conversation.
4. Confirm a normalized JSONL file is created.
5. Load the output through the existing extractor event loader indirectly by running the extractor command.
6. Manually inspect whether message order, roles, and content are correct.
7. Record results in the validation table below.

The current importer command:

```powershell
.\.venv\Scripts\python.exe scripts\import_official_export.py `
  --provider <chatgpt|claude|gemini> `
  --input <path-to-export> `
  --output local_import_outputs\<provider>_sample.jsonl
```

Optional conversation selection:

```powershell
--conversation-index 0
```

or:

```powershell
--conversation-id "<provider-conversation-id>"
```

Basic extractor smoke test:

```powershell
.\.venv\Scripts\python.exe -m session_state local_import_outputs\<provider>_sample.jsonl --cutoff 5 --provider gemini
```

If no LLM API key is available, skip the extractor call and inspect the JSONL manually. The import validation can still proceed.

## Normalized JSONL acceptance criteria

The generated file should contain one JSON object per line:

```jsonl
{"type":"user_message","content":"..."}
{"type":"assistant_message","content":"..."}
```

Allowed `type` values:

- `user_message`
- `assistant_message`
- `tool_call`
- `tool_result`
- `system_event`

Minimum acceptable result:

- file exists
- valid JSONL
- at least one `user_message`
- at least one `assistant_message`
- user/assistant order matches the source conversation
- no obvious duplicate turns
- no obvious missing main assistant response
- existing loader can read the JSONL

## ChatGPT validation procedure

### Export source

Use the official ChatGPT data export.

Expected MVP input:

- ZIP archive
- contains `conversations.json`
- `conversations.json` is a list of conversation objects
- conversation may contain a `mapping` tree and `current_node`

### Command

```powershell
.\.venv\Scripts\python.exe scripts\import_official_export.py `
  --provider chatgpt `
  --input local_exports\chatgpt_export.zip `
  --output local_import_outputs\chatgpt_sample.jsonl
```

Try another conversation:

```powershell
.\.venv\Scripts\python.exe scripts\import_official_export.py `
  --provider chatgpt `
  --input local_exports\chatgpt_export.zip `
  --output local_import_outputs\chatgpt_sample_3.jsonl `
  --conversation-index 3
```

### Normal success criteria

Record as success if:

- importer finds `conversations.json`
- selected conversation is converted without error
- output includes user and assistant turns
- turns follow the visible conversation order
- multi-message conversations are not collapsed into one giant turn
- content from text/code blocks is preserved well enough for session understanding
- output can be read by the existing session loader/extractor

### Partial success criteria

Record as partial success if:

- importer creates JSONL but misses some content blocks
- system/tool/code-interpreter messages are skipped
- attachments/files are not represented
- branching conversations are flattened but not exactly as expected
- conversation title/id selection works, but ordering needs manual verification

### Failure criteria

Record as failure if:

- `conversations.json` is not found
- selected conversation produces no messages
- only user messages or only assistant messages are extracted
- message order is wrong
- output is invalid JSONL
- existing loader cannot read the result

### ChatGPT edge cases to check

- conversation with code blocks
- conversation with multiple assistant responses/regenerations
- conversation with edited messages
- conversation with shared files or attachments
- conversation using tools/code interpreter/data analysis
- conversation with images
- very long conversation
- conversation that starts with system/developer metadata

## Claude validation procedure

### Export source

Use the official Claude data export.

Important:

> Claude support is currently best-effort. The importer has not been verified against a real Claude export archive.

Expected MVP input:

- ZIP archive, extracted directory, or JSON file
- importer searches JSON files for conversation-like structures
- preferred file names include `conversations.json` and `chats.json`
- supported message list keys include `messages`, `chat_messages`, `turns`, `entries`, and `items`

### Command

```powershell
.\.venv\Scripts\python.exe scripts\import_official_export.py `
  --provider claude `
  --input local_exports\claude_export.zip `
  --output local_import_outputs\claude_sample.jsonl
```

Try a specific conversation if IDs are visible:

```powershell
.\.venv\Scripts\python.exe scripts\import_official_export.py `
  --provider claude `
  --input local_exports\claude_export.zip `
  --output local_import_outputs\claude_selected.jsonl `
  --conversation-id "<uuid>"
```

### Normal success criteria

Record as success if:

- importer finds a conversation-like JSON file
- selected conversation is converted without error
- human/user turns become `user_message`
- Claude responses become `assistant_message`
- message order matches the source conversation
- output can be read by the existing session loader/extractor

### Partial success criteria

Record as partial success if:

- text messages are imported but artifacts are missing
- project context is missing
- attachments are skipped
- conversation metadata is ignored
- only the main text thread is preserved

For the current MVP, missing artifacts or project context should be expected unless proven otherwise.

### Failure criteria

Record as failure if:

- importer cannot find a conversation-like JSON collection
- roles are not recognized
- output contains only one side of the conversation
- artifacts replace the main text or corrupt output
- output is invalid JSONL
- existing loader cannot read the result

### Claude edge cases to check

- conversation with artifacts
- conversation with project context
- conversation with uploaded files
- conversation with code blocks
- conversation with long assistant responses
- conversation with edited/retried responses
- conversation from Team/Enterprise export if available

## Gemini validation procedure

### Export source

Use Google Takeout with Gemini Apps data.

Important:

> Gemini support is currently best-effort. Real Google Takeout compatibility is not yet verified.

The biggest unknown is whether the export contains complete conversation turns or mostly activity/prompt records. If Takeout contains only activity history, the importer may not be able to reconstruct full sessions.

Expected MVP input:

- ZIP/TGZ if supported by the environment, extracted directory, or JSON file
- current implementation supports ZIP and directories/JSON files
- importer searches JSON files and prefers names such as `conversations.json`, `gemini.json`, `MyActivity.json`, and `My Activity.json`

Note:

> If Google Takeout produces `.tgz`, extract it locally first and pass the extracted directory unless ZIP conversion is available. The current MVP directly handles ZIP, JSON, and directories.

### Command

```powershell
.\.venv\Scripts\python.exe scripts\import_official_export.py `
  --provider gemini `
  --input local_exports\gemini_takeout.zip `
  --output local_import_outputs\gemini_sample.jsonl
```

If Takeout is `.tgz`, first extract it:

```powershell
tar -xf local_exports\gemini_takeout.tgz -C local_exports\gemini_takeout
```

Then import from the extracted directory:

```powershell
.\.venv\Scripts\python.exe scripts\import_official_export.py `
  --provider gemini `
  --input local_exports\gemini_takeout `
  --output local_import_outputs\gemini_sample.jsonl
```

### Normal success criteria

Record as success if:

- importer finds a Gemini conversation-like JSON file
- output contains both user prompts and Gemini responses
- turns are in correct order
- text content is sufficient to understand the session
- output can be read by the existing session loader/extractor

### Partial success criteria

Record as partial success if:

- importer extracts user prompts but not Gemini responses
- generated media is missing
- uploaded files are missing
- activity metadata is present but usable conversation text is incomplete
- each activity item becomes a separate one-turn session rather than a full conversation

For Gemini, partial success should be expected until real Takeout structure is confirmed.

### Failure criteria

Record as failure if:

- no conversation-like JSON is found
- output has no supported messages
- output has only metadata
- message order cannot be determined
- output is invalid JSONL
- existing loader cannot read the result

### Gemini edge cases to check

- simple text-only Gemini conversation
- multi-turn Gemini conversation
- conversation with generated images/media
- conversation with uploaded files
- conversation using Gems
- conversation with Canvas-like output
- Takeout file where only activity/prompt data is present
- `.tgz` extracted directory structure

## Manual JSONL inspection checklist

After import, open the generated JSONL and check:

| Check | Pass? | Notes |
|---|---|---|
| File exists |  |  |
| File is valid JSONL |  |  |
| Contains `user_message` |  |  |
| Contains `assistant_message` |  |  |
| First user turn is correct |  |  |
| First assistant turn is correct |  |  |
| Message order matches source |  |  |
| Code blocks/text blocks preserved |  |  |
| No obvious duplicated turns |  |  |
| No obvious missing main response |  |  |
| Existing loader/extractor can read it |  |  |
| Sensitive data redacted before sharing |  |  |

## Import result record

Use this table for each validation run.

| Field | Value |
|---|---|
| Date |  |
| Reviewer |  |
| Provider | ChatGPT / Claude / Gemini |
| Export source | ZIP / extracted directory / JSON |
| Export account type | Free / Plus / Pro / Team / Enterprise / Workspace / Unknown |
| Export date |  |
| Input path kept local? | yes / no |
| Command run |  |
| Conversation selector | index / id / none |
| Conversation title/id |  |
| Import result | success / partial_success / failure |
| Records generated |  |
| Has user messages? | yes / no |
| Has assistant messages? | yes / no |
| Order correct? | yes / no / unknown |
| Existing loader works? | yes / no |
| Extractor smoke test run? | yes / no |
| Main missing content |  |
| Edge cases present |  |
| Privacy redaction needed? | yes / no |
| Notes |  |

## Provider summary table

Use this table to summarize compatibility after several validation runs.

| Provider | Export sample count | Success | Partial | Failure | Main blocker | Confidence |
|---|---:|---:|---:|---:|---|---|
| ChatGPT |  |  |  |  |  | low / medium / high |
| Claude |  |  |  |  |  | low / medium / high |
| Gemini |  |  |  |  |  | low / medium / high |

## Decision rules after validation

Do not claim provider support from one happy-path run.

Suggested confidence levels:

- **Low confidence**: one synthetic test or one real export with major unknowns.
- **Medium confidence**: at least two real exports from the provider, basic text conversations work, known limitations documented.
- **High confidence**: multiple real exports across account types and edge cases, failures are understood, importer behavior is repeatable.

Provider status language:

- Use **experimental import** if only partial real validation exists.
- Use **best-effort import** if structure varies or important content may be missing.
- Use **supported import** only after repeated real-export validation.

