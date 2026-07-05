# Phase 0.5 Decision Memo

## Decision

**Continue.**

Phase 0.5 shows that the project has enough evidence to continue as an **Evidence-grounded Session Representation Engine**.

The next sprint should move from validation artifacts to a **Session Viewer MVP**.

The bottleneck is no longer whether representations can be generated from real ChatGPT Export data. The next bottleneck is whether users can conveniently read and use those representations in a product-like interface.

## What Phase 0.5 Validated

### 1. ChatGPT Export Import

The project validated real ChatGPT Official Export compatibility.

Observed result:

- real export ZIP was processed
- split `conversations-*.json` export structure was supported
- all 124 conversations were importable
- original ZIP and private generated artifacts were kept outside source control

This confirmed that ChatGPT Export can be used as a realistic source for Phase 0 validation.

### 2. Normalized JSONL Generation

All imported ChatGPT conversations were converted into normalized JSONL.

Result:

```text
124 / 124 normalized JSONL files generated
```

This validated the current normalized JSONL boundary as a useful intermediate format.

### 3. Representation Generation

Using the generated normalized JSONL files, the batch runner produced representation JSON files for all 124 conversations.

Final state:

```text
124 representation files available
102 newly generated in the final batch
22 skipped because existing files were reused
0 final failures
```

This confirms that the current Representation Engine can operate across a real ChatGPT Export dataset.

### 4. Batch Quality Report

The Phase 0.5 quality report analyzed the generated representation set.

Key observations:

- Goal Stack empty: 3 / 124
- Current Situation empty: 0 / 124
- Active Goal empty: 13 / 124
- Blocker present: 9 / 124
- Blocker none_observed: 114 / 124
- Blocker unknown: 1 / 124

The strongest structural signal is that **Current Situation was generated for every sample**.

The weakest structural signal is **Blocker interpretation**.

### 5. Review Book

A Phase 0.5 Review Book was generated to allow human review across all 124 representations.

The Review Book showed that the generated output can be rendered into a human-readable review workflow without re-running the extractor.

This is important because it demonstrates that representation JSON can be treated as a product artifact, not only as an experiment artifact.

### 6. Human Review Result

An independent Human Reviewer-style evaluation was performed over the 124 generated representations.

Summary:

| Overall | Count |
| --- | ---: |
| PASS | 81 |
| MINOR ISSUE | 31 |
| MAJOR ISSUE | 12 |

Average scores:

| Category | Average |
| --- | ---: |
| Goal Stack | 4.19 / 5 |
| Current Situation | 4.31 / 5 |
| Blocker | 3.68 / 5 |
| Evidence | 5.00 / 5 |
| Human Usability | 4.22 / 5 |

This supports the claim that the representation is often useful enough for a human to understand the session faster than reading the raw log.

## Validated Hypotheses

### Hypothesis 1: Goal Stack helps users understand session flow.

**Validated with caveats.**

Goal Stack is useful for medium and long sessions with evolving objectives. It helps explain how the conversation moved from earlier goals to the active goal.

It is less useful for very short conversations. One-turn or two-turn sessions often do not contain enough information to justify a full Goal Stack.

### Hypothesis 2: Current Situation helps users understand the current state.

**Strongly validated.**

Current Situation was the most stable field.

It was generated for all 124 representations and generally provides the fastest path to understanding the checkpoint state.

This field is central to the product value.

### Hypothesis 3: Evidence grounding increases trust.

**Validated.**

Evidence IDs make the representation auditable.

The evidence count distribution was manageable:

- average evidence count: about 5
- p90 evidence count: about 11
- max evidence count: 17

This suggests the engine can provide grounding without overwhelming the reviewer in most cases.

### Hypothesis 4: Representation reduces the need to reread raw logs.

**Partially validated.**

For medium and long sessions, the representation often gives enough structure to understand the session without immediately opening the raw log.

For very short sessions, raw log review may still be faster than reading a structured representation.

For sensitive or ambiguous blocker cases, raw log review remains necessary.

## Weak Areas

### 1. Blocker Definition

Blocker is the weakest field.

Current blocker statuses:

```text
present: 9
none_observed: 114
unknown: 1
```

This raises a product question:

> Is a blocker only a hard execution obstacle, or should it include user hesitation, missing decisions, uncertainty, or misunderstanding?

The current schema does not clearly distinguish these cases.

### 2. Short Session Handling

Very short conversations often produce weak or unnecessary Goal Stack output.

The system needs a clearer product treatment for low-context sessions.

Possible future direction:

- mark as Low Context
- show a minimal summary
- avoid over-interpreting goals

### 3. Hard Blocker vs Soft Blocker

The evaluation suggests a need to distinguish:

- Hard Blocker: quota exceeded, API failure, missing file, auth failure
- Decision Blocker: user needs to choose
- Strategy Blocker: direction/product decision unclear
- Understanding Blocker: user does not understand the output or next step

This should not be changed immediately, but it should inform future schema design.

### 4. Third-party Cold Read Validation

The current review is still close to the project context.

The next validation step should involve a cold reader who did not build the schema or prompt.

The key test:

> Can a third-party reviewer understand the session in 30 seconds from the representation alone?

## Product Judgment

## Continue

The project should continue.

Reason:

The Representation Engine is useful enough at MVP level. The next bottleneck is not the extraction algorithm. The next bottleneck is presentation.

The product now needs a way for users to actually browse, compare, and inspect generated session representations.

Therefore, the next sprint should focus on:

```text
Session Viewer MVP
```

not more extraction tuning.

## Next Sprint: Session Viewer MVP

The next sprint should build a minimal local viewer for generated representation JSON files.

Primary goal:

> Let a user open a folder of representation JSON files and quickly understand what each AI session was about.

The viewer should make the existing engine output feel like a product.

It should focus on:

- session list
- current goal
- current situation
- blocker
- evidence
- status badge
- low-context handling

## What Not To Do Now

The next sprint should explicitly avoid:

- prompt improvement
- schema improvement
- provider abstraction
- new supervision detectors
- desktop app development
- large refactoring
- new model integrations
- dashboard complexity

These may become relevant later, but they are not the immediate bottleneck.

## Final Sprint Transition

Phase 0.5 answered:

> Can the engine generate useful representations from real ChatGPT Export data?

Answer:

> Yes, with known weaknesses around Blocker and short sessions.

The next sprint should answer:

> Can users consume these representations in a product-like interface without reading raw logs?

That is the purpose of Session Viewer MVP.

