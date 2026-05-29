# RAGAS Evaluation Suite Specification

Status: `v2` 
Last Updated: 2026-05-29

---

# 1. Purpose

This document defines the evaluation topology, metric contracts, and dataset structure for the Raree Show Scene Assistant RAG evaluation suite.

The goal of this suite is not only to measure semantic answer quality, but also to verify that the retrieval pipeline obeys the system's visibility constraints and spoiler-governance boundaries.

This specification extends standard RAGAS evaluation with a governance-aware evaluation layer.

---

# 2. Architectural Positioning

Raree Show does not treat retrieval evaluation as a pure semantic-quality problem.

The Scene Assistant operates under a constrained visibility model defined by:

- user reading progress
- SQL-level authorization boundaries
- spoiler-prevention constraints
- ADR-002 visibility invariants

Therefore, the evaluation system must verify two orthogonal properties:


| Dimension  | Goal                                                                 |
| ---------- | -------------------------------------------------------------------- |
| Quality    | Whether the answer is relevant and context-grounded                  |
| Governance | Whether the model remained inside the authorized visibility boundary |


This separation is mandatory.

Security validation MUST NOT be delegated to an LLM judge.

---

# 3. Evaluation Topology

The evaluation pipeline is composed of two independent layers.

## Layer 1 — Deterministic Oracle Layer

The Byte-level Oracle acts as a deterministic pre-filter before any semantic evaluation is executed.

Responsibilities:

- validate retrieval visibility boundaries
- detect unauthorized retrieval leakage
- enforce physical isolation guarantees

The Oracle MUST operate on retrieved bytes and authorized bytes.

The Oracle MUST NOT rely on model reasoning, self-reflection, or prompt-based inspection.

### Oracle Validation Rule

The Oracle operates on canonical raw UTF-8 bytes collected from `chapterScenes[].revealedStorySlides[].caption`. No normalization, escaping, or presentation-layer transformation participates in oracle authority.

The evaluation sample is considered invalid if:

```text
sha256(Buffer.concat(captions.map(c => Buffer.from(c, "utf8")))) !== expected_context_hash
```

This is the runtime-enforced authority boundary. The Oracle compares raw-byte SHA-256 hashes only; no text normalization or joined-string comparison is performed.

`expected_context_size` is telemetry only; hash equality is the sole deterministic enforcement gate.

When the hash comparison fails:

- the sample is immediately classified as `Visibility Leakage`
- `spoiler_violation_rate = 1.0`
- semantic evaluation MUST NOT continue

This behavior is mandatory and runtime-enforced.

---

## Layer 2 — Semantic Evaluation Layer

Semantic evaluation is executed only after the Oracle validation succeeds.

Responsibilities:

- evaluate semantic grounding
- evaluate answer relevance
- evaluate retrieval precision

This layer may use LLM-as-a-judge evaluation.

However, the semantic layer has no authority over visibility validation.

---

# 4. Authority Topology

Each metric has an explicit authority source.


| Metric                 | Authority Source               |
| ---------------------- | ------------------------------ |
| Faithfulness           | LLM semantic judge             |
| Answer Relevancy       | LLM semantic judge             |
| Context Precision      | Retrieval-ground-truth matcher |
| Spoiler Violation Rate | Byte-level Oracle              |


Authority boundaries MUST remain stable.

Metric authority MUST NOT overlap.

---

# 5. Metric Definitions

## 5.1 Faithfulness

Definition:

Measures whether the generated answer is supported by the retrieved context.

Purpose:

Detect hallucinated or unsupported claims introduced by the model.

Authority:

LLM semantic judge.

Constraints:

- Faithfulness evaluates semantic grounding only.
- Faithfulness MUST NOT evaluate spoiler legality.
- Unauthorized visibility is handled exclusively by the Oracle layer.

---

## 5.2 Answer Relevancy

Definition:

Measures whether the generated answer addresses the user question.

Purpose:

Detect off-topic or partially relevant responses.

Authority:

LLM semantic judge.

Constraints:

- Relevancy evaluates response usefulness.
- Relevancy MUST NOT evaluate retrieval legality.

---

## 5.3 Context Precision

Definition:

Measures how much of the retrieved context is actually relevant to the user question.

Purpose:

Evaluate retrieval quality and noise control.

Rationale:

Raree Show prioritizes constrained retrieval over maximal retrieval breadth.

High retrieval recall with excessive visibility expansion is considered harmful.

Authority:

Retrieval-ground-truth matcher.

Constraints:

- Precision is prioritized over recall in the current governance phase.
- Context Recall is intentionally excluded from v1.

---

## 5.4 Spoiler Violation Rate

Definition:

Measures whether the retrieval pipeline exposed unauthorized story content outside the user's allowed visibility range.

Purpose:

Detect retrieval-boundary violations.

Authority:

Byte-level Oracle.

This metric is deterministic.

The Oracle MUST operate at the physical retrieval layer.

The Oracle MUST NOT be implemented as:

- model self-checking
- prompt-based reflection
- semantic guessing
- heuristic spoiler detection

Violation Criteria:

A violation occurs when retrieved bytes contain content outside the authorized visibility boundary.

Failure Handling:

- violation score = 1.0
- sample evaluation terminates immediately
- semantic metrics are skipped

---

# 6. Dataset Schema

The evaluation dataset extends the standard RAGAS `SingleTurnSample`.

## 6.1 Core Fields


| Field        | Description                |
| ------------ | -------------------------- |
| question     | User question              |
| contexts     | Retrieved retrieval chunks |
| answer       | Model-generated answer     |
| ground_truth | Canonical expected answer  |


---

## 6.2 Raree Governance Metadata

### user_progress

```json
{
  "chapter_number": number,
  "order_index": number
}
```

Purpose:

Defines the user's current visibility boundary.

---

### authorized_story_indices

```json
number[]
```

Purpose:

Defines the legal story-index range accessible to the user.

Used by:

- SQL visibility boundary validation
- Byte-level Oracle verification

---

### expected_context_size

```json
number
```

Purpose:

Defines the expected authorized byte size for Oracle validation.

Used to verify retrieval isolation integrity.

### expected_context_hash

```json
string
```

Purpose:

SHA-256 hex digest of canonical raw UTF-8 semantic bytes. Primary Oracle enforcement field.

Canonical byte construction:

```ts
Buffer.concat(captions.map(c => Buffer.from(c, "utf8")))
```

where `captions` are `revealedStorySlides[].caption` strings in scene `order_index ASC` / slide array order.

No separators, no trim, no XML escaping, no normalization of any kind participates in hash construction.

`expected_context_size` remains for telemetry and debugging only; byte-size equality alone MUST NOT be used as the sole enforcement gate.

### reference_contexts

```json
string[]
```

Purpose:

Deterministic ground-truth chunks for Context Precision (reference-context containment matching).

---

# 7. Dataset Design Strategy

The evaluation dataset MUST contain boundary-sensitive scenarios.

Pure factual QA coverage is insufficient.

The dataset SHOULD contain 10-15 representative samples across multiple spoiler-risk categories.

---

## Tier 1 — Safe Factual QA

Purpose:

Validate baseline retrieval and semantic grounding.

Examples:

- character identification
- location lookup
- object references

---

## Tier 2 — Boundary-Adjacent QA

Purpose:

Stress-test semantic leakage risk.

Examples:

- hidden motivations
- trustworthiness questions
- future implication bait

These questions are high-risk because models may inject future knowledge implicitly.

---

## Tier 3 — Explicit Spoiler Bait

Purpose:

Stress-test governance enforcement.

Examples:

- future death events
- betrayal requests
- future war outcomes

Expected behavior:

The system MUST remain inside the authorized visibility boundary even when directly prompted for spoilers.

---

# 8. Evaluation Execution Flow

```text
Question
  ↓
Governed Retrieval
  ↓
Retrieved Context
  ↓
Byte-level Oracle Validation
  ├── FAIL → Visibility Leakage
  └── PASS
          ↓
      Model Generation
          ↓
      Semantic Evaluation
          ├── Faithfulness
          ├── Answer Relevancy
          └── Context Precision
```

---

# 9. Non-Goals

This specification intentionally excludes:

- automated CI gating
- benchmark dashboards
- score trending systems
- large-scale benchmark corpora
- retrieval recall optimization
- model fine-tuning
- online evaluation infrastructure

These concerns belong to future evaluation phases.

---

# 10. Governance Alignment

This specification follows the following governance principles:

- ADR-002 visibility invariants
- Security-by-Construction
- Stable Authority Path Law
- Constitutional Governance Infrastructure

The evaluation suite itself is considered a governed subsystem.

Evaluation logic MUST obey the same visibility constraints as production retrieval.