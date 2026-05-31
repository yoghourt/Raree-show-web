# Evaluation Baseline Freeze Contract

**Status:** Active  
**Version:** v1  
**Authority:** Governance Gap Closure — EAR Follow-up #3 (2026-05-31)  
**Scope:** Evaluation baseline governance lifecycle only. Does not modify evaluation runtime, provider architecture, or ADR topology.

---

## 1. Purpose

This document formally defines the governance lifecycle of an evaluation baseline in this repository.

It exists to eliminate ambiguity about:

- When a baseline officially exists
- When a baseline is frozen
- What may change before freeze
- What may not change after freeze
- Whether judge identity is a baseline identity field

This contract is authoritative within the Governance Architecture Layer.  
It supplements `docs/specs/ragas-evaluation-suite.md` with lifecycle governance.

---

## 2. Baseline Lifecycle

A baseline passes through the following states:

```text
DRAFT → CANDIDATE → FROZEN → SUPERSEDED
```

### 2.1 DRAFT

**Definition:**  
A baseline that exists only in the working directory. No repository-traceable history exists.

**Entry conditions:**
- Evaluation run has been initiated
- At least one sample report has been written to disk

**Governance authority:**  
None. An untracked baseline artifact is a narrative claim only. Under FOUNDATION.md §6 (Zero-Trust Governance Principle), governance validity must not depend solely on narrative claims. A DRAFT baseline has no authority over other artifacts.

**Exit conditions:**
- All samples are complete (no `_pending_` values in any oracle-passing sample's semantic metrics)
- Baseline document reflects complete aggregate metrics
- Baseline artifact has been committed and is available in repository history
- → Transitions to: **CANDIDATE**

---

### 2.2 CANDIDATE

**Definition:**  
A baseline that has been committed and is available in repository history, awaiting governance acceptance.

**Entry conditions:**
- All samples complete
- Baseline document committed to a feature branch
- Artifact available via `git log` on that branch

**Governance authority:**  
Under review. Artifacts are subject to reviewer-authorized modification. The baseline is not yet authoritative.

**Exit conditions:**
- Committed artifact is merged into the default branch → Transitions to: **FROZEN**
- Commit is reverted or branch abandoned → Transitions to: **DRAFT**

> **Note on workflow independence:** The CANDIDATE state is defined by commit existence in repository history, not by the creation of a pull request, code review tool, or platform-specific review mechanism. A baseline reaches CANDIDATE as soon as the artifact is committed and pushed, regardless of whether a PR has been opened. This keeps the lifecycle contract independent of hosting platform or branching strategy.

---

### 2.3 FROZEN

**Definition:**  
A baseline whose artifact has been merged into the default branch.

**Entry conditions:**
- Baseline artifact appears in `git log` of the default branch
- Baseline ID (e.g., `ragas-baseline-v1`) is unique and immutable

**Governance authority:**  
Full. A frozen baseline is authoritative. Future evaluation runs MUST compare against frozen aggregate values. Mutation of any baseline identity field after freeze requires a new baseline.

**Exit conditions:**
- A new baseline reaches FROZEN state with a higher version ID
- → Transitions to: **SUPERSEDED**

---

### 2.4 SUPERSEDED

**Definition:**  
A frozen baseline that has been replaced by a newer frozen baseline.

**Entry conditions:**
- A successor baseline has reached FROZEN state

**Governance authority:**  
Archival. A superseded baseline MUST NOT be used as the active comparison target. It MUST remain in the repository as an immutable historical record.

---

## 3. Baseline Identity

The following fields jointly constitute baseline identity. All are required for a baseline to transition from DRAFT to CANDIDATE.

| Field | Baseline Identity? | Source |
| --- | --- | --- |
| `dataset_version` | **Yes — Required** | `eval/ragas/constants.ts` |
| `oracle_version` | **Yes — Required** | `eval/ragas/constants.ts` |
| `evaluation_version` | **Yes — Required** | `eval/ragas/constants.ts` |
| `judge_identity` | **Yes — Required** | Baseline document Environment table |
| `aggregate_metrics` | **Yes — Required** | Baseline document Aggregate Metrics section |

### 3.1 Judge Identity Definition

`judge_identity` is expressed as a compound field in `provider:model` format.

Examples:

```text
google:gemini-2.5-flash
openrouter:qwen3-32b
openrouter:openai/gpt-4o
```

`judge_identity` governs the semantic evaluation layer only (Faithfulness, Answer Relevancy).  
Oracle metrics (Spoiler Violation Rate) and Context Precision are judge-independent and remain valid across judge identity changes.

`judge_identity` MUST be recorded in the baseline document Environment table before the baseline transitions from DRAFT to CANDIDATE.

### 3.2 Schema Gap Note

The current `SuiteReport` TypeScript schema (`eval/ragas/types.ts`) does not include a `judge_identity` field. Until schema support exists, `judge_identity` MUST be recorded in the baseline artifact's Environment table.

Future schema alignment is recommended to make judge identity machine-readable and enforce it at report generation time.

---

## 4. Mutation Authority Matrix

### Before Freeze (DRAFT or CANDIDATE state)

| Field | Mutable? | Condition if changed |
| --- | --- | --- |
| `dataset_version` | Yes | Must re-run all samples with new dataset |
| `oracle_version` | Yes | Must re-run all samples with new oracle semantics |
| `evaluation_version` | Yes | Must re-run all samples under new evaluation version |
| `judge_identity` | Yes | Must re-run all oracle-passing samples with new judge. See §6. |
| `aggregate_metrics` | Yes | Output of re-run; must reflect the complete run |

**Internal consistency requirement:**  
All semantic metric scores in the baseline document MUST have been produced by a single `judge_identity`. Mixing scores from different judge identities in one baseline document is prohibited.

### After Freeze (FROZEN state)

| Field | Mutable? | Consequence of change |
| --- | --- | --- |
| `dataset_version` | **No** | Requires new baseline |
| `oracle_version` | **No** | Requires new baseline |
| `evaluation_version` | **No** | Requires new baseline |
| `judge_identity` | **No** | Requires new baseline |
| `aggregate_metrics` | **No** | Historical record — immutable |

---

## 5. Freeze Events

### 5.1 Baseline Exists

A baseline first exists when an evaluation run produces at least one sample report on disk.  
At this point the baseline is in **DRAFT** state with no governance authority.

### 5.2 Baseline Candidate

A baseline becomes a Candidate when:

```text
git commit <baseline-artifact>
git push
```

This is the DRAFT → CANDIDATE transition event.

**Required preconditions at commit time:**
1. All samples evaluated: no `_pending_` values in any oracle-passing sample's semantic metrics
2. Aggregate metrics section is fully populated
3. `judge_identity` is recorded in the Environment table in `provider:model` format
4. `evaluation_version`, `oracle_version`, `dataset_version` match values in `eval/ragas/constants.ts` at time of run

### 5.3 Baseline Frozen

A baseline is frozen when:

```text
Baseline artifact is merged into the default branch
```

This is the CANDIDATE → FROZEN transition event.

The freeze event is repository-traceable via `git log` on the default branch.

**No other event freezes a baseline.** Specifically:
- Declaring `Status: ACCEPTED` in the document text does **not** freeze a baseline
- Declaring `Frozen: <date>` in the document text does **not** freeze a baseline
- These declarations are narrative. Freeze authority requires commit history on the default branch.

---

## 6. Judge Identity Handling

### 6.1 Before Freeze

**Does changing judge identity before freeze constitute Design Iteration or Baseline Modification?**

**Answer: Design Iteration**, subject to the full re-run requirement.

A `judge_identity` change before freeze (while baseline is in DRAFT or CANDIDATE state) is a Design Iteration because:

- No frozen baseline artifact exists in the repository
- A DRAFT baseline has no governance authority (FOUNDATION.md §6)
- The `SemanticJudgeAdapter` interface was architecturally designed to support judge injection

**Required condition:** If `judge_identity` changes, all oracle-passing samples MUST be re-evaluated under the new judge before the baseline document records any scores. Scores produced by the prior judge MUST NOT be retained in the same baseline document.

### 6.2 After Freeze

**Does changing judge identity after freeze require a new baseline?**

**Answer: Yes. Unconditionally.**

After freeze, `judge_identity` is immutable. A judge identity change requires:

1. A new baseline ID (e.g., `ragas-baseline-v2`)
2. A complete re-evaluation of all oracle-passing samples under the new `judge_identity`
3. A new DRAFT → CANDIDATE → FROZEN lifecycle for the new baseline
4. The prior baseline transitions to SUPERSEDED

Partial re-runs under a different judge against a frozen baseline are prohibited.

---

## 7. Non-Goals

This contract intentionally excludes:

- Gemini vs. OpenRouter provider selection
- Evaluation runtime redesign
- Provider failover for evaluation
- CI merge blocking or automated enforcement
- ADR creation

---

## 8. Governance Alignment

This contract is consistent with and subordinate to:

- `governance/FOUNDATION.md` — Zero-Trust Governance Principle (§6), Audit Continuity Principle (§7)
- `governance/specs/CHANGE_TELEMETRY_SPEC.md` — Traceability Law (§8.1)
- `docs/adr/003-multi-provider-ai-runtime.md` — "provider-pinned evaluation determinism" (§2 Constraint 3)
- `docs/specs/ragas-evaluation-suite.md` — evaluation topology and metric authority contracts

On conflict with the above, the authority hierarchy defined in `governance/FOUNDATION.md §3` prevails.
