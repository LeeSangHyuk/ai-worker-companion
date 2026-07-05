# Project Vision

## Positioning

AI Worker Companion is currently an **Evidence-grounded Session Representation Engine**.

It is not yet a Session Supervision Layer. The current product value is to transform long AI agent session logs into a compact, evidence-backed representation that a human can understand quickly:

- Goal Stack
- Current Situation
- Blocker
- Evidence

The long-term vision is to evolve into a **Session Supervision Layer** that can help humans decide whether an AI agent session is healthy, drifting, blocked, or in need of intervention. That supervision vision should be built on top of a validated representation layer, not assumed before the representation itself is proven useful.

## Why this distinction matters

An observability platform usually answers:

> What calls happened? What were the traces, latency, cost, errors, and metrics?

A session representation engine answers:

> What was this agent trying to do, what is the current situation, what is blocking progress, and what evidence supports that interpretation?

A session supervision layer answers:

> Is this session still healthy, or should a human intervene now?

This project is currently strongest in the second category. It may later expand into the third category, but Phase 0 should avoid overclaiming supervision capabilities.

## Current category

Recommended current category:

> Evidence-grounded Session Representation Engine for long-running AI agent sessions.

Recommended long-term category:

> Session Supervision Layer for AI coding agents.

Recommended combined positioning:

> A session representation engine today, designed to become a supervision layer after its representations and intervention signals are validated.

## README first paragraph draft

AI Worker Companion is an evidence-grounded Session Representation Engine for long-running AI agent sessions. It turns raw session logs into structured representations such as Goal Stack, Current Situation, Blocker, and supporting Evidence, so a human can understand and resume a session quickly. The project’s long-term vision is to become a Session Supervision Layer, but the current V0 focuses on validating whether these representations help people understand a session in about 30 seconds.

## Product thesis

Long-running AI agent sessions are difficult to resume from raw logs. A trace may show every step, but it does not automatically tell a human what the agent was trying to accomplish, what changed, what remains unresolved, or whether the session is safe to continue.

The project’s thesis is:

> If multiple AI systems can produce similar, evidence-grounded session representations from the same raw session, and humans find those representations useful for quickly understanding and resuming the session, then the representation format is a viable foundation for future supervision.

## What Phase 0 should prove

Phase 0 should prove representation usefulness, not supervision.

The core Phase 0 question is:

> Can a human understand and resume a long AI session faster with Goal Stack, Current Situation, Blocker, and Evidence than by reading the raw session directly?

The secondary Phase 0 question is:

> Are the generated representations stable enough across models to be trusted as a product primitive?

Agreement is useful here, but it is not the final objective. Agreement is an internal stability signal. The final objective is human usefulness.

## What Phase 0 should not include

Phase 0 should not introduce:

- new health detectors
- new dashboards
- new UI layers
- new intervention recommendation flows
- broad observability features
- production alerting

The project should resist becoming a general observability platform too early. The sharper path is to first validate that its representation format is useful, compact, evidence-grounded, and stable enough.

## Role of agreement

Cross-model agreement should be used as an internal validation method.

It can help answer:

- Do different models identify similar goals?
- Do they agree on the current situation?
- Do they select overlapping evidence?
- Do they agree that no blocker is present, or that a blocker exists?

But agreement is not sufficient by itself. Multiple models can agree on a generic, vague, or incomplete representation. Human evaluation is still required to judge usefulness.

## Role of human evaluation

The human evaluator is not primarily creating a perfect gold-label string.

Instead, the human evaluator judges whether the representation is useful:

- Can I understand the session quickly?
- Can I tell what the agent was trying to do?
- Can I tell what changed recently?
- Can I tell what remains unresolved?
- Can I verify the representation from evidence?
- Would this help me resume or supervise the session?

This means existing `expected.json` files should be treated as **Reference Representations**, not final Gold Labels.

## Roadmap interpretation

The roadmap should be read as:

1. **Phase 0: Representation Engine**
   - Validate Goal Stack, Current Situation, Blocker, and Evidence.
   - Compare reference and actual outputs.
   - Use cross-model agreement as a stability signal.
   - Use human review as the final usefulness test.

2. **Phase 1: Agreement & Usefulness**
   - Expand evaluation across more real sessions.
   - Track where models agree and disagree.
   - Identify schema or prompt weaknesses.
   - Refine the representation format only when failures are repeated and meaningful.

3. **Phase 2: Health Monitor**
   - Evaluate whether raw-event health signals are useful.
   - Keep repeated command and repeated error as early signals.
   - Do not add more detectors until the existing ones are measured.

4. **Phase 3: Session Supervision Layer**
   - Add intervention-oriented capabilities only after representation and health signals prove useful.
   - The supervision layer should answer whether a human should intervene, not merely summarize the session.

## Product boundary

This project should not compete directly with LangSmith, Langfuse, Phoenix, or Helicone as a full observability platform.

The better product boundary is:

> A meaning layer over agent session logs.

It can eventually integrate with observability tools, but its unique value is not raw tracing, metrics, cost tracking, or dashboards. Its unique value is turning a long session into a compact, evidence-grounded representation that a human can act on.
