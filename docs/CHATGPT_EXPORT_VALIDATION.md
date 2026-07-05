# ChatGPT Export Validation

## Purpose

This document records a real ChatGPT Official Export compatibility check.

The goal of this validation was not to declare full provider support. The goal was to verify whether the current Import MVP can handle an actual ChatGPT export ZIP, produce the project’s normalized JSONL format, and allow the existing loader/extractor pipeline to produce a Session Representation.

No raw conversation text, ZIP contents, or personal data is copied into this document.

## Validation Date

- Date: 2026-06-29
- Source: real ChatGPT Official Export ZIP provided by the user
- ZIP storage during validation: outside the project workspace
- Project file committed/added for this validation: this documentation file only

## Source Handling

The export ZIP was initially found under `raw_data/`.

To avoid accidentally including the ZIP in the project or future Git operations, it was moved to a local validation folder outside the workspace:

```text
C:\Users\Public\Documents\ESTsoft\CreatorTemp\agent-session-state-extractor-validation\
```

Generated validation artifacts were also kept in that same external folder:

```text
chatgpt_export_0.jsonl
chatgpt_export_1.jsonl
chatgpt_export_2.jsonl
chatgpt_export_0.representation.json
chatgpt_export_1.representation.json
chatgpt_export_2.representation.json
```

These files may contain private session content and should not be committed.

## Actual Export Structure Observed

The actual ZIP did not contain a single root-level `conversations.json` file.

Instead, the export contained split conversation files:

```text
conversations-000.json
conversations-001.json
```

Additional JSON files were present, including metadata and settings files. The validation did not rely on these files for conversation import.

The conversation files had the expected ChatGPT conversation shape:

- top-level JSON value: list
- each conversation: object
- important keys observed:
  - `id`
  - `conversation_id`
  - `title`
  - `current_node`
  - `mapping`
- `mapping`: object keyed by node id
- node shape included:
  - `id`
  - `parent`
  - `message`
- message shape included:
  - `author`
  - `content`
  - `create_time`
  - `metadata`
- content shape included:
  - `content_type`
  - `parts`

This means the existing ChatGPT `mapping/current_node` parsing assumption is still broadly correct, but the file discovery assumption was incomplete.

## Initial Import Result

The first import attempt failed.

Command shape:

```powershell
.\.venv\Scripts\python.exe .\scripts\import_official_export.py `
  --provider chatgpt `
  --input <external-validation-folder>\ChatGPTExport.zip `
  --output <external-validation-folder>\chatgpt_export_0.jsonl `
  --conversation-index 0
```

Failure:

```text
error: export archive does not contain any of: conversations.json
```

Cause:

The importer only searched for `conversations.json`. The real export used split files named `conversations-000.json`, `conversations-001.json`.

## Minimal Importer Change

The importer was minimally updated to support ChatGPT split conversation files.

Changed behavior:

- still supports `conversations.json`
- additionally supports `conversations-*.json`
- merges the split conversation lists before applying `--conversation-index` or `--conversation-id`

Files changed:

```text
src/session_state/official_export_importer.py
```

Extractor and evaluator were not changed.

## Regression Check

The existing official export importer tests were run after the change.

Command:

```powershell
.\.venv\Scripts\python.exe -m unittest tests.test_official_export_importer -v
```

Result:

```text
Ran 4 tests
OK
```

## Import Success Result

After the minimal importer change, three conversations were imported from the real export ZIP.

The actual conversation titles are intentionally omitted from this document.

| Sample | Conversation index | Normalized records | Loader result |
| --- | ---: | ---: | --- |
| sample 0 | 0 | 125 | success |
| sample 1 | 1 | 10 | success |
| sample 2 | 2 | 2 | success |

Loader event type counts:

| Sample | user_message | assistant_message | tool_call | tool_result | system_event |
| --- | ---: | ---: | ---: | ---: | ---: |
| sample 0 | 64 | 61 | 0 | 0 | 0 |
| sample 1 | 5 | 5 | 0 | 0 | 0 |
| sample 2 | 1 | 1 | 0 | 0 | 0 |

This confirms that the current normalized JSONL shape can represent text-only ChatGPT conversations from the real export.

## Extractor Smoke Test

The imported JSONL files were then passed through the existing loader/extractor path.

The extractor was run with the configured Gemini provider to verify that the existing Session Representation pipeline can produce:

- Goal Stack
- Current Situation
- Blocker
- Evidence

Extractor and evaluator code were not modified.

Result:

| Sample | Goal Stack generated | Current Situation generated | Blocker generated | Evidence count |
| --- | --- | --- | --- | ---: |
| sample 0 | yes | yes | yes | 28 |
| sample 1 | yes | yes | yes | 10 |
| sample 2 | yes | yes | yes | 2 |

One operational issue was observed during the first extractor run:

```text
UnicodeEncodeError: 'cp949' codec can't encode character
```

Cause:

The model output contained a Unicode character that the default Windows console encoding could not print.

Resolution for validation:

```powershell
$env:PYTHONIOENCODING = "utf-8"
[Console]::OutputEncoding = [Text.UTF8Encoding]::new()
```

This was an execution environment issue, not an extractor schema issue.

## Compatibility Assessment

### Confirmed

- A real ChatGPT Official Export ZIP can be read after supporting split `conversations-*.json` files.
- The observed conversation structure still matches the `mapping/current_node` parser approach.
- The importer can produce normalized JSONL for real exported conversations.
- The existing loader can read the generated JSONL.
- The existing extractor can generate Session Representation output from the imported JSONL.
- No extractor or evaluator changes were required.

### Partially Confirmed

- Long conversation reconstruction worked for at least one imported conversation with 125 normalized records.
- Text-only user/assistant order appears preserved based on loader counts and successful extraction.
- The validation did not manually audit every turn against the original export UI, so complete turn-by-turn fidelity is not yet fully proven.

### Not Confirmed

- Attachment handling.
- Image/file message handling.
- Canvas or tool-specific ChatGPT artifacts.
- Branching conversation behavior beyond the selected `current_node` path.
- Whether all split conversation files should always be merged in lexical order for every future export.
- Whether archived/deleted/shared conversation metadata should affect import selection.

## Remaining Limitations

1. The importer currently extracts the selected `current_node` chain, not every possible branch in a ChatGPT conversation tree.
2. Tool calls are not represented for ChatGPT export samples in this validation because the imported records were user/assistant text messages only.
3. Export metadata files are not used for reporting or selection.
4. The CLI does not yet produce an `import_report.json`; validation notes were recorded manually here.
5. Large exports may require better conversation listing/selection UX before they are comfortable for normal users.
6. Real export validation should be repeated with conversations containing attachments, images, code interpreter/tool activity, and branching.

## Conclusion

The current Import MVP is compatible with the tested real ChatGPT Official Export after one minimal importer fix for split `conversations-*.json` files.

The most important Phase 0 assumption held:

> ChatGPT Official Export can be normalized without changing the extractor/evaluator boundary, and the resulting session can produce an evidence-grounded Session Representation.

This should still be described as validated on one real export sample set, not as complete ChatGPT Export support.

