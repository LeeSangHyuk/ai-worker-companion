# Phase 0 Validation Plan

## Objective

Phase 0 validates the current project as an **Evidence-grounded Session Representation Engine**.

The goal is not to prove that the system can supervise sessions yet. The goal is to test whether Goal Stack, Current Situation, Blocker, and Evidence help a human understand and resume a long AI session quickly.

The key question:

> Can a human understand the session in about 30 seconds from the generated representation, and can they verify that representation from evidence?

## Scope

Included in Phase 0:

- Goal Stack
- Current Situation
- Blocker
- Evidence grounding
- Reference representation vs model actual comparison
- Cross-model agreement as an internal stability signal
- Human usefulness review

Excluded from Phase 0:

- new health detectors
- new UI or dashboard work
- intervention recommendation
- automated alerting
- production observability metrics
- treating expected JSON as final Gold Label

Health Signal evaluation should remain Phase 2 or later.

## 1. How to interpret `chatgpt_1` through `chatgpt_5` actual/expected comparison

The existing `chatgpt_1` through `chatgpt_5` files should be interpreted as a small exploratory validation set.

The `.expected.json` files are **Reference Representations**, not Gold Labels. They are useful for comparison, but they should not be treated as exact answers.

The `.actual.json` files should be reviewed against the reference outputs using the following interpretation:

### Goal Stack

Do not score Goal Stack by exact string match.

Review:

- whether the primary goal captures the broad session intent
- whether the active goal captures the current checkpoint focus
- whether previous goals represent meaningful prior subgoals rather than over-segmented details
- whether goal shift detection is reserved for material direction changes

Accept semantic differences if they preserve the same session understanding.

Flag problems when:

- the primary goal is too generic to be useful
- the active goal describes an assistant response rather than the user’s current task
- previous goals omit important prior context needed for handoff
- normal subgoal progression is mislabeled as a goal shift

### Current Situation

Current Situation should be judged by usefulness and faithfulness, not wording.

Review:

- whether it is at most two sentences
- whether it reflects the checkpoint moment
- whether it includes recent confirmed progress
- whether it includes the current focus or remaining condition
- whether it avoids future advice
- whether its claims are supported by evidence

Flag problems when:

- it becomes a generic summary
- it omits the most handoff-relevant finding
- it presents an assistant suggestion as if it were confirmed user intent
- it overstates facts not present in the session
- it fails to mention an unresolved condition that matters for resuming

### Blocker

Blocker can be reviewed more categorically than Goal Stack or Current Situation.

Review:

- whether the status matches the session evidence
- whether a constraint is truly blocking progress
- whether a resolved limitation is incorrectly marked as a blocker
- whether `none_observed` is used when no active blocker exists

Flag problems when:

- a minor limitation is treated as a blocker
- a real dependency on user input is missed
- an unavailable option is marked as blocking even though another valid path exists

### Evidence

Evidence should be reviewed for both coverage and minimality.

Review:

- whether the selected evidence supports the representation
- whether important evidence is missing
- whether too many evidence IDs are selected without need
- whether the evidence includes the checkpoint-relevant turns

High evidence overlap is a good signal, but it is not enough. Evidence can be broad and still fail to support the most important claim precisely.

## 2. Human evaluation questions

For each sample, the human reviewer should answer the following questions.

### 30-second understanding

1. After reading only the representation, can you explain what the session is about?
2. Can you identify the current focus of the session?
3. Can you tell what changed or progressed recently?
4. Can you tell whether there is an active blocker?
5. Would this be enough to resume the session without rereading the full raw log?

### Goal Stack quality

6. Is the primary goal broad enough to cover the session, but specific enough to be useful?
7. Is the active goal aligned with the checkpoint moment?
8. Are previous goals meaningful, or are they missing/over-fragmented?
9. Is goal shift detection correct?

### Current Situation quality

10. Is the situation summary faithful to the evidence?
11. Does it include recent confirmed progress?
12. Does it include the current focus or remaining condition?
13. Does it avoid advice, speculation, and future recommendations?
14. Is it concise enough to read quickly?

### Blocker quality

15. Is the blocker status correct?
16. If a blocker is present, is it actionable and evidence-backed?
17. If no blocker is present, is that absence reasonable?

### Evidence quality

18. Can you verify the representation from the selected evidence?
19. Is any important evidence missing?
20. Is any selected evidence unnecessary or distracting?

### Overall usefulness

21. Would this representation reduce your time to understand the session?
22. Would you trust it enough to continue the session?
23. What is the single most important missing or misleading part?
24. Rate the representation:
    - useful
    - partially useful
    - not useful
    - unsafe or misleading

## 3. Criteria for a good representation

A good representation should satisfy the following criteria.

### Faithful

It must not claim more than the evidence supports.

Good:

- “The assistant framed the symptoms as consistent with dryness.”

Risky:

- “The user has dryness.”

The second statement may be medically or factually stronger than the session evidence allows.

### Checkpoint-aware

It should describe the session at the checkpoint moment, not the whole conversation in a timeless way.

Good:

- “The deployment direction has narrowed, and the remaining question is how to handle free usage and API cost.”

Weak:

- “The conversation discussed deployment options.”

### Handoff-useful

It should help a human continue the session.

That means it should preserve:

- the current task
- recent confirmed progress
- unresolved condition
- blocker status
- supporting evidence

### Concise

Current Situation should be at most two sentences.

Goal Stack should avoid turning every minor topic into a separate goal.

Evidence should be sufficient but not noisy.

### Structured but not brittle

The representation should allow semantic variation.

Different models may phrase the same goal differently. That is acceptable if the human can understand and resume the same session from either output.

### Evidence-grounded

Every important claim should be traceable to selected evidence.

Evidence should not be decorative. It should allow the reviewer to check why the representation says what it says.

## 4. Failure criteria

A representation should be considered failed if any of the following are true.

### Misleading current state

The representation causes the reviewer to misunderstand what is currently happening.

Examples:

- says work is completed when the session is waiting for a decision
- says there is a blocker when a valid path is already available
- says the user’s goal changed when the session only moved to a normal subgoal

### Missing handoff-critical context

The representation omits information needed to resume the session.

Examples:

- omits the actual current focus
- omits a recent decision
- omits a constraint that affects the next step
- omits a previous goal that explains why the current focus exists

### Unsupported claim

The representation includes claims that cannot be verified from evidence.

Examples:

- diagnosing a user’s condition when the session only contains assistant explanation
- treating a suggestion as confirmed user intent
- inferring completion without evidence of completion

### Too generic to be useful

The representation is technically true but not helpful.

Examples:

- “The user asked for help with a project.”
- “The assistant provided feedback.”
- “The session discussed configuration.”

### Evidence failure

The selected evidence does not support the representation, misses key evidence, or includes too much irrelevant evidence to be useful.

### Format failure

The output violates the intended V0 structure:

- missing Goal Stack
- missing Current Situation
- missing Blocker
- missing Evidence
- Current Situation longer than two sentences
- future advice included in Current Situation

## 5. Next data collection criteria

The next dataset should move beyond the current five ChatGPT samples.

New samples should be selected to test whether the representation format works on real long-running agent sessions.

### Source criteria

Prefer real AI coding agent sessions from:

- Codex
- OpenCode
- Claude Code
- other terminal-based coding agents

ChatGPT-style conversations can remain as auxiliary data, but they should not be the main validation source.

### Session criteria

Collect sessions that include at least one of the following:

- long multi-step coding work
- multiple tool calls
- file edits
- tests or verification steps
- a meaningful handoff point
- a user decision or constraint
- a possible blocker
- a visible change in focus

Avoid only collecting clean successful sessions. The dataset should include messy sessions too.

### Minimum metadata

For each sample, record:

- source tool
- approximate session length
- checkpoint point
- whether the session starts mid-conversation
- whether raw logs were sanitized
- whether the sample contains private or sensitive content
- reviewer notes

### Labeling approach

For each sample, create:

- raw session JSONL
- reference representation
- model actual output
- human usefulness review

The human review should not be framed as exact gold-label creation. It should judge whether the representation is useful, faithful, and sufficient for resuming the session.

### Dataset balance

The next validation set should include:

- successful sessions
- blocked sessions
- sessions with user waiting points
- sessions with repeated errors
- sessions with normal goal progression
- sessions with true goal shifts
- sessions that start mid-conversation
- sessions where a generic summary would be insufficient

### Suggested next milestone

Before adding new features, collect and review approximately 15 to 20 real coding-agent sessions.

For each session, answer:

1. Did the representation help a reviewer understand the session in about 30 seconds?
2. Was the representation faithful to evidence?
3. Did different models produce compatible representations?
4. Which field was most unstable?
5. What type of session caused the most failures?

Only after this review should the project decide whether to modify the schema, refine prompts, or move toward Phase 2 health monitoring.

