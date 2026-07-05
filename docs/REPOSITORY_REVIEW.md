# Repository Review for MVP Packaging

Date: 2026-07-04

Purpose: prepare the repository for GitHub/MVP presentation without moving, deleting, or refactoring files.

This review treats the project as a product transitioning out of research mode.

## 1. Current Structure Assessment

The repository currently contains three overlapping layers:

1. **Core Session Representation Engine**
   - Extracts / represents session state.
   - Provides schemas, prompts, importers, health checks, and CLI surfaces.
2. **Product Prototype**
   - Companion mock.
   - Agent integration PoC.
   - Session viewer prototype.
3. **Research / Validation Artifacts**
   - ChatGPT sample labels.
   - Phase 0 / Phase 0.5 reports.
   - Evaluation scripts and generated outputs.

The project direction is now clearer than the repository layout.

Current product center:

```text
Core Engine
  -> Agent Adapter
  -> Companion
  -> Notification
  -> Recovery
```

Current repository problem:

- Product files, research files, generated files, and validation fixtures are all visible at the top level.
- README has a good new architecture section, but much of the later content appears mojibake/encoding-corrupted.
- A new GitHub visitor would see a serious project, but would need more than 30 seconds to understand what is product vs experiment.

## 2. File Classification

### 2.1 Core Engine

These files are part of the durable engine or its direct CLI/API surface.

| Path | Role | Keep in MVP? | Notes |
|---|---|---:|---|
| `src/session_state/models.py` | Representation schema / data models | Yes | Core schema. |
| `src/session_state/prompt.py` | Extractor prompt | Yes | Core extraction behavior. |
| `src/session_state/extractor.py` | LLM-backed extractor | Yes | Core engine. |
| `src/session_state/official_export_importer.py` | Official export importer | Yes | Important input path. |
| `src/session_state/chatgpt_ingestion.py` | Legacy ChatGPT raw ingestion | Maybe | Useful but more research/fixture-specific now. |
| `src/session_state/codex_log.py` | Codex log/session parsing | Maybe | Core-adjacent if agent sessions remain a target. |
| `src/session_state/health.py` | Health signal detectors | Maybe | Currently not product focus, but part of validated engine history. |
| `src/session_state/health_evaluation.py` | Health evaluation support | No / Archive candidate | More evaluation than product engine. |
| `src/session_state/__main__.py` | Package CLI entry | Yes | Core CLI surface. |
| `src/session_state/__init__.py` | Package init | Yes | Core package. |
| `session_state.py` | Agent-facing Core CLI | Yes | Very important product interface. |
| `run_batch.py` | Batch representation generation CLI | Maybe | Useful for validation, but not required for viewer/companion MVP. |
| `pyproject.toml` | Packaging metadata | Yes | Required for install/test. |

### 2.2 Product

These files express the product direction and should stay prominent.

| Path | Role | Keep in MVP? | Notes |
|---|---|---:|---|
| `companion/` | AI Worker Companion mock | Yes | Main product prototype. |
| `companion/index.html` | Companion browser mock | Yes | Current UX artifact. |
| `companion/companion.js` | Companion UI controller | Yes | Product prototype code. |
| `companion/companion.css` | Companion styling | Yes | Product prototype code. |
| `companion/notifications/notification.js` | Notification abstraction | Yes | Important adapter seam. |
| `companion/recovery/recovery.js` | Handoff/recovery prompt generator | Yes | Product recovery boundary. |
| `companion/state/state.js` | Companion state normalization | Yes | Adapter seam. |
| `companion/README.md` | Companion documentation | Yes | Good product-level explanation. |
| `integrations/` | Agent adapter experiments | Yes | Product extension layer. |
| `integrations/opencode/` | First OpenCode adapter PoC | Yes | First integration target. |
| `viewer/session_viewer.html` | Static session viewer output | Archive candidate | Useful historical prototype, but not current product center. |

### 2.3 Research

These files are valuable for project history and validation, but should not dominate the MVP repository surface.

| Path | Role | Suggested handling |
|---|---|---|
| `evaluation/` | Health/evaluation annotation guide and manifests | Keep but move under archive/research later. |
| `raw_data/` | ChatGPT 1-5 raw/jsonl/expected/actual fixtures | Keep as research fixtures; consider sanitization before GitHub. |
| `samples/` | Small fixtures and health detector samples | Keep as examples/tests; separate from raw research data. |
| `scripts/evaluate_samples.py` | Legacy expected-vs-actual evaluation | Research. |
| `scripts/evaluate_health.py` | Health detector evaluation | Research. |
| `scripts/build_phase05_review_book.py` | Human review book generator | Research. |
| `reviews/PHASE05_REPRESENTATION_REVIEW_BOOK.md` | Human review artifact | Archive candidate. |
| `docs/PHASE0_VALIDATION_PLAN.md` | Phase 0 validation planning | Archive candidate. |
| `docs/PHASE05_DECISION_MEMO.md` | Phase 0.5 decision memo | Keep in archive/history. |
| `docs/PHASE05_FULL_HUMAN_EVALUATION.md` | Full human eval report | Archive candidate. |
| `docs/PHASE05_HUMAN_EVALUATION_QUALITY_REPORT.md` | Batch quality report | Archive candidate. |
| `docs/CHATGPT_EXPORT_VALIDATION.md` | Import validation report | Archive/history. |
| `docs/CHATGPT_EXPORT_BATCH_REVIEW.md` | Batch review report | Archive/history. |
| `docs/CHATGPT_EXPORT_REPRESENTATION_REVIEW.md` | Representation review report | Archive/history. |
| `docs/AGENT_SESSION_SOURCES.md` | Agent source research | Keep as research/reference. |
| `docs/PLUGIN_POC.md` | Plugin feasibility research | Keep as research/reference. |
| `docs/COMPANION_PLATFORM_FIT.md` | Platform fit decision | Keep near product docs for now. |
| `docs/OPENCODE_POC.md` | OpenCode PoC decision | Keep near integrations docs. |
| `docs/roadmap.html` | Roadmap visualization | Archive candidate. |
| `VISION.md` | Earlier project vision | Archive/merge candidate. |
| `STATE_SCHEMA_AND_EVALUATION.md` | Earlier schema/evaluation notes | Archive/merge candidate. |

### 2.4 Generated

These are generated outputs or run artifacts. They should not be prominent in an MVP GitHub repository.

| Path | Role | Suggested handling |
|---|---|---|
| `outputs/` | 147 generated representation/batch files | Archive or exclude from default repo view. |
| `reports/phase05_representation_quality_summary.json` | Generated quality summary | Archive/generated. |
| `reviews/PHASE05_REPRESENTATION_REVIEW_BOOK.md` | Generated review book | Archive/generated. |
| `viewer/session_viewer.html` | Generated/static viewer output | Archive or regenerate on demand. |
| `evaluation_output.txt` | Console run output | Archive/generated. |
| `evaluation_goal_stack.txt` | Console run output | Archive/generated. |
| `raw_data/chatgpt_*.actual.json` | Generated actual extractor outputs | Archive/generated fixtures. |
| `outputs/representations_full_124/` | Partial/older batch output | Archive/generated. |
| `outputs/representations_full_124_gemini_3_1_flash_lite/` | Main generated batch output | Archive/generated. |

### 2.5 Temporary

These should not be part of a clean MVP-facing repository.

| Path | Reason |
|---|---|
| `__pycache__/` | Python cache. |
| `src/session_state/__pycache__/` | Python cache. |
| `scripts/__pycache__/` | Python cache. |
| `tests/__pycache__/` | Python cache. |
| `.venv/` | Local environment. |
| `.agents/` | Local agent/runtime state. |
| `.agent-handoff/` | Local handoff/plugin state. |
| `raw_data/gemini_1.txt` | Empty file; likely abandoned fixture. |

No files should be deleted as part of this review, but these are strong `.gitignore` / archive candidates.

## 3. Archive Candidates

Archive means “preserve, but remove from the main product path.”

Recommended archive buckets:

```text
archive/
  research/
  generated/
  phase05/
  legacy/
```

### Strong Archive Candidates

| Candidate | Why archive is appropriate |
|---|---|
| `outputs/` | Large generated batch artifacts. Useful for validation history, noisy for product users. |
| `reports/` | Generated summaries from Phase 0.5. Important historically, not core product. |
| `reviews/` | Human evaluation review book. Useful evidence, not product runtime. |
| `viewer/` | Session Viewer was an intermediate product exploration before Companion direction. |
| `evaluation_output.txt` | Console artifact. |
| `evaluation_goal_stack.txt` | Console artifact. |
| `docs/PHASE05_FULL_HUMAN_EVALUATION.md` | Long research report; should not define first product impression. |
| `docs/PHASE05_HUMAN_EVALUATION_QUALITY_REPORT.md` | Research validation report. |
| `docs/PHASE05_DECISION_MEMO.md` | Keep but move to archive/history after README distills conclusion. |
| `docs/PHASE0_VALIDATION_PLAN.md` | Earlier validation plan; no longer the active sprint. |
| `docs/roadmap.html` | Historical visualization; product docs should be Markdown-first. |
| `STATE_SCHEMA_AND_EVALUATION.md` | Legacy research note; merge durable parts into docs if needed. |
| `VISION.md` | Legacy vision; merge with `docs/PROJECT_VISION.md` if still relevant. |
| `raw_data/chatgpt_*.actual.json` | Generated actual outputs. |
| `raw_data/chatgpt_*.expected.json` | Research labels/reference representations. |
| `raw_data/chatgpt_*.txt` | Raw private-ish fixtures; should be sanitized or excluded before public GitHub. |

### Keep Visible for MVP

| Candidate | Why keep visible |
|---|---|
| `src/session_state/` | Core package. |
| `session_state.py` | Agent-facing CLI. |
| `companion/` | Main product prototype. |
| `integrations/` | Product extension layer. |
| `docs/ARCHITECTURE.md` | Product architecture. |
| `docs/PROJECT_VISION.md` | Product vision. |
| `docs/COMPANION_PLATFORM_FIT.md` | Current platform decision. |
| `docs/OPENCODE_POC.md` | Current first integration PoC. |
| `docs/SESSION_VIEWER_MVP.md` | Useful historical product design, but should be secondary. |
| `tests/` | Required for confidence. |
| `samples/` | Useful minimal examples. |

## 4. Recommended MVP Repository Structure

This is a proposed structure only. Do not move files yet.

```text
ai-worker-companion/
  README.md
  pyproject.toml
  session_state.py

  src/
    session_state/
      models.py
      prompt.py
      extractor.py
      official_export_importer.py
      health.py
      codex_log.py
      ...

  companion/
    index.html
    companion.css
    companion.js
    state/
    notifications/
    recovery/
    README.md

  integrations/
    opencode/
      README.md
      adapter/
      .opencode/

  docs/
    ARCHITECTURE.md
    PROJECT_VISION.md
    COMPANION_PLATFORM_FIT.md
    OPENCODE_POC.md
    REPOSITORY_REVIEW.md
    import/
    research/

  examples/
    minimal_representation.json
    sample_session.jsonl

  tests/
    test_session_state_cli.py
    test_official_export_importer.py
    test_ingestion_failures.py

  scripts/
    import_official_export.py
    run_health_check.py
    verify_session_state_cli.py

  archive/
    research/
      phase0/
      phase05/
      chatgpt_validation/
    generated/
      outputs/
      reports/
      reviews/
      viewer/
    legacy/
```

### Suggested Product-First Ordering

The public-facing repository should guide readers in this order:

1. What this is
2. Why it exists
3. How the architecture works
4. How to run the Core CLI
5. How to open the Companion mock
6. How integrations attach
7. Where research artifacts live

## 5. README Improvement Points

Current README status:

- The top architecture section is directionally useful.
- The previous name “Agent Session State Extractor” no longer fully matches the product direction.
- Much of the README content after the first section appears encoding-corrupted.
- It mixes old extractor/evaluation instructions with newer Companion/Adapter positioning.
- A GitHub visitor would not understand the MVP in 30 seconds without already knowing the project history.

### Missing or weak points

1. **Clear product opening**
   - The first paragraph should define the product in one sentence.
   - It should mention AI Worker Companion, not only Extractor.

2. **Simple diagram**
   - The architecture diagram is present, but should be connected to a product sentence.

3. **MVP status**
   - README should state this is an MVP/prototype, not production-ready supervision.

4. **What works today**
   - Core CLI can read representation JSON.
   - Companion mock can display agent state.
   - OpenCode adapter skeleton exists.

5. **What is not included**
   - No automatic recovery.
   - No new session execution.
   - No persistent OpenCode/Codex UI yet.
   - No production-grade monitoring yet.

6. **Quickstart**
   - One command for `session_state.py`.
   - One instruction for opening `companion/index.html`.
   - One note for OpenCode PoC.

7. **Research separation**
   - Validation reports should be linked under “Research history,” not mixed into the main setup flow.

8. **Encoding cleanup**
   - The README needs to be rewritten or re-encoded before public GitHub release.
   - This is currently the largest packaging issue.

## 6. Final Product Definition

Current implementation 기준 제품 정의:

> An agent-agnostic AI Worker Companion that turns long-running AI session state into a human-readable status, notification, and recovery handoff layer.

Shorter version:

> AI Worker Companion helps humans understand, monitor, and recover long-running AI agent sessions without rereading the raw log.

## 7. Packaging Recommendation

Do not present the project as only an extractor anymore.

Recommended public framing:

```text
AI Worker Companion

An agent-agnostic companion layer for understanding, monitoring, and recovering long-running AI agent sessions.
```

Recommended internal framing:

```text
Core Engine
  -> represents session state

Companion
  -> makes state visible to humans

Integrations
  -> attach Companion to specific AI agents

Research Archive
  -> preserves validation history without dominating the MVP
```

## 8. Immediate Non-Code Next Step

Before implementing more features, prepare a public-facing README draft that:

- renames the project positioning from “Session State Extractor” to “AI Worker Companion”
- keeps the current package/repo name for continuity
- links research artifacts as background
- explains OpenCode as the first integration target, not the only product target
- clearly states that recovery is handoff-only and human-approved

This would make the repository feel like an MVP product instead of a lab notebook.
