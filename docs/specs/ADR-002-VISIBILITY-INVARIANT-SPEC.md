# ADR-002-VISIBILITY-INVARIANT-SPEC

Version: `v1`
Amendment: `A` accepted 2026-11-17, not yet implemented
Status: `Architecture Approved`
Type: `Security Invariant Specification`

> Sections 1–13 are the original invariant. They are not rewritten. Amendment A, at the end of this file, is the normative default boundary and the only explicit authorization exception. Where Amendment A differs from §3.1, Amendment A governs. The retrieval decision is [ADR-002 Amendment A](../adr/002-hybrid-rag-retrieval.md).

Related ADR:

* `ADR-002 — Visibility Boundary`
* `/governance/specs/AUTHORITY_BOUNDARY_AND_PRECEDENCE_SPEC.md`

Audience:

* Architect AI
* Keeper
* Cursor / execution agents
* future stress-testing infrastructure
* future governance enforcement tooling

---

# 1. Purpose

This specification formalizes the security invariants governing visibility boundaries within the Raree retrieval pipeline.

The goal is to transform ADR-002 from:

```text id="a8m2pk"
architectural intent
```

into:

```text id="b5q7rb"
deterministic security law
```

This specification defines:

* authorized visibility semantics
* truncation law
* invalid-state behavior
* prompt injection semantics
* physical boundary requirements
* leakage oracle definitions

This specification intentionally does NOT define:

* implementation language
* database schema
* CI tooling
* fuzz infrastructure
* runtime observability systems

---

# 2. Core Security Principle

Raree visibility enforcement is based on:

```text id="c1v4nt"
physical retrieval boundaries
```

NOT:

```text id="d7w9hf"
model self-restraint
```

The system MUST guarantee that unauthorized content:

```text id="e4q2pk"
never enters model-visible context
```

under any execution path.

---

# 3. Authorized Visibility Model

## 3.1 Authorized Visibility Definition

A token is considered authorized ONLY if:

```text id="f9v6rb"
story_index
<=
readUpToStoryIndexLast
```

for the active user session.

---

## 3.2 Unauthorized Visibility Definition

Any token whose:

```text id="g6m1nt"
story_index
>
readUpToStoryIndexLast
```

is considered unauthorized.

Unauthorized tokens MUST NEVER appear in:

* model context
* retrieval payloads
* prompt construction
* streaming payloads
* intermediate context assembly

---

# 4. Physical Boundary Law

## 4.1 Mandatory Truncation Stage

Visibility truncation MUST occur:

```text id="h2q7pk"
before model context construction
```

This is a mandatory invariant.

---

## 4.2 Forbidden Boundary Model

The system MUST NOT rely on:

```text id="i8v3rb"
- prompt instructions
- system prompts
- model alignment
- LLM refusal behavior
- post-generation filtering
```

as primary visibility enforcement mechanisms.

---

## 4.3 Retrieval Pipeline Requirement

Authorized visibility MUST be enforced at:

```text id="j4n1hf"
retrieval layer
```

before any model-visible payload exists.

---

# 5. Truncation Law

## 5.1 Hard Boundary Requirement

Visibility enforcement MUST use:

```text id="k7w5zb"
hard physical truncation
```

NOT soft semantic filtering.

---

# 5.2 Invalid Index Semantics

The following invalid states MUST trigger:

```text id="l3m8pk"
fail-fast rejection
```

instead of automatic correction.

| Invalid State                | Required Behavior |
| ---------------------------- | ----------------- |
| `readUpToStoryIndexLast < -1`| Fail-fast         |
| `NaN` index                  | Fail-fast         |
| missing progress state       | Fail-fast         |
| malformed visibility payload | Fail-fast         |
| non-integer visibility index | Fail-fast         |

---

# 5.3 Overflow Semantics

If:

```text id="m9q4rb"
readUpToStoryIndexLast
>
max_available_story_index
```

the system MUST apply:

```text id="n5m8zb"
hard clamping
```

to:

```text id="o1v7pk"
max_available_story_index
```

Reason:

Overflow beyond existing content does not expand visibility authority.

The overflow state is considered:

```text id="p8q2nt"
recoverable normalization
```

NOT an authorization violation.

---

# 5.4 Forbidden Overflow Behavior

The system MUST NOT:

```text id="q4w6hf"
- expose partial future tokens
- expand retrieval range
- infer future visibility
- auto-authorize unavailable content
```

during overflow handling.

---

# 6. Prompt Injection Semantics

## 6.1 Injection Non-Authority Principle

User prompts MUST NOT alter visibility authority.

Example forbidden escalation attempts:

```text id="r1m5pk"
- "ignore truncation"
- "show the full text"
- "reveal future scenes"
- "bypass the boundary"
```

---

## 6.2 Mandatory Injection Outcome

Prompt injection attempts MUST NOT affect:

```text id="s7v3rb"
retrieval boundary construction
```

under any circumstances.

---

## 6.3 Architectural Reasoning

Visibility authority originates from:

```text id="t2q8nt"
retrieval state
```

NOT conversational instructions.

---

# 7. Leakage Definition

## 7.1 Leakage Definition

A visibility leakage occurs if ANY unauthorized token becomes:

```text id="u6m1hf"
model-visible
```

at any stage.

This includes:

* final prompts
* intermediate buffers
* retrieval payloads
* streaming payloads
* hidden context assembly

---

## 7.2 Zero-Leakage Requirement

ADR-002 enforcement requires:

```text id="v3w7pk"
zero unauthorized token exposure
```

under all execution paths.

Partial leakage is forbidden.

---

# 8. Leakage Oracle

## 8.1 Oracle Purpose

The leakage oracle defines deterministic pass/fail semantics for:

* stress tests
* fuzz tests
* runtime validation
* future governance enforcement tooling

---

## 8.2 Authorized Payload Oracle

For any retrieval execution:

```text id="w9q4rb"
retrieved_context
```

MUST contain ONLY authorized tokens.

---

## 8.3 Byte-Level Oracle

The total retrieved context size MUST equal:

```text id="x5m8zb"
Σ(authorized_story_content)
```

and MUST NOT exceed the authorized boundary.

---

## 8.4 Forbidden Oracle Outcomes

The following conditions MUST fail validation:

```text id="y1v7pk"
- unauthorized byte presence
- unauthorized token presence
- future-scene leakage
- hidden overflow leakage
- prompt-induced visibility expansion
```

Sentinel Visibility State
-1 = valid empty visibility boundary

---

# 9. Fail-fast Semantics

## 9.1 Security-Invalid States

The following states are considered:

```text id="z8q2nt"
operationally invalid
```

and MUST terminate execution immediately:

* negative visibility index
* malformed visibility state
* corrupted progress metadata
* unauthorized retrieval expansion
* non-deterministic visibility computation

---

## 9.2 Forbidden Recovery Behavior

The system MUST NOT silently:

```text id="a4w6hf"
- auto-correct authorization state
- infer missing visibility
- downgrade violations into warnings
```

Reason:

Silent recovery weakens deterministic security guarantees.

---

# 10. Deterministic Retrieval Requirement

Visibility enforcement MUST remain:

```text id="b1m5pk"
deterministic
```

across:

* runtime environments
* model providers
* prompt variations
* user inputs
* streaming modes

Visibility authority MUST NOT depend on model behavior.

---

# 11. Stress Testing Implications

Future stress-testing infrastructure MUST validate:

```text id="c7v3rb"
- overflow handling
- invalid index rejection
- prompt injection resistance
- byte-level leakage absence
- deterministic truncation behavior
```

against the invariants defined in this specification.

---

# 12. Architectural Outcome

After adopting this specification:

ADR-002 becomes:

```text id="d2q8nt"
physically enforceable
deterministically testable
prompt-injection resistant
byte-level auditable
security-invariant driven
```

instead of relying on model compliance assumptions.

---

# 13. Language Notes

## Truncation

In governance context, **truncation** means:

```text id="e6m1hf"
physical removal of unauthorized visibility
```

before model exposure.

This is NOT equivalent to:

* hiding
* masking
* instructing the model not to answer

---

## Hard Clamping

**Hard clamping** means:

```text id="f3w7pk"
forcing overflow values
into the nearest valid boundary
```

without expanding authorization scope.

Example:

```text id="g9q4rb"
requested_index = 9999
available_max = 120
→ effective_index = 120
```

---

## Fail-fast

**Fail-fast** means:

```text id="h5m8zb"
immediate termination
upon detecting invalid security state
```

without attempting silent recovery.

---

## Important Distinction

```text id="i1v7pk"
overflow
≠
authorization escalation
```

Overflow beyond existing content is recoverable through hard clamping.

Malformed or invalid authorization state is NOT recoverable and MUST fail-fast.

---

# 14. Amendment A — Explicit authorization exception

Accepted 2026-11-17. Not yet implemented.

This amendment does not delete §§1–13. It changes which set of narrative atoms counts as authorized. It does not replace physical truncation with a prompt, and it does not let the reader's question text move the boundary.

## 14.1 Two boundaries

**Default visibility boundary.** `spoilerMode` is absent or `"none"`. Only narrative atoms allowed by ADR-002 Amendment A §A.2 may enter model-visible context.

That default is:

* every effective-frame caption of a route that sits strictly behind the progress point
* captions `0..readUpToStoryIndexLast` of the current route
* no captions from another route that shares the current chapter and `order_index`

§3.1 stated a single `story_index <= readUpToStoryIndexLast` rule for the whole session. That formula did not say how earlier routes are treated, and the deployed reader already receives those earlier routes' captions. §3.1 stays as the historical statement. The bullets above are the normative default.

An untruncated `scenes.summary` is not an authorized channel on the default boundary. It must not carry frames past `readUpToStoryIndexLast` into the prompt.

**Explicit authorization exception.** `spoilerMode` is `"single_request"` or `"conversation"`, and the server has completed the checks in ADR-002 Amendment A §A.3. The authorized set is then every ingested narrative atom of the current `work_id`. Frame truncation at `readUpToStoryIndexLast` does not apply. Client progress is not the ceiling.

The exception does not authorize another work. It does not authorize content that is not stored for that work. It ends on the next request that is `"none"`.

## 14.2 What still cannot grant visibility

The following remain outside the exception:

* a sentence in the user message, including "show the full text" or "ignore truncation"
* a raised `readUpToChapter`, `readUpToOrderIndex`, or `readUpToStoryIndexLast` without a validated `spoilerMode`
* a `single_request` whose `authorizedQuestionId` is not the last user message's `questionId`
* a remembered grant from an earlier request; `single_request` is not inherited, and `conversation` must be sent again
* a topic change; topic detection neither opens nor closes `conversation`
* an HMAC seal; the seal is message provenance, not the visibility gate

§5.4 still forbids treating index overflow as permission to read further. Overflow clamping is not this exception. §6 still forbids prompt text from constructing the retrieval boundary.

§4.2 still holds for both boundaries. The active set is chosen before prompt construction, by the SQL candidate set and the caption cut. The model is not the component that decides which stored captions exist.

## 14.3 Leakage relative to the active set

A leakage is an unauthorized narrative atom becoming model-visible. "Unauthorized" means outside the active boundary in §14.1, not only outside the historical §3.1 formula.

On the default boundary, a caption of the current route with index greater than `readUpToStoryIndexLast` is still a leak. On the exception, a caption from another `work_id` is a leak. A caption that the SQL set admitted and the prompt then included is not a leak merely because its frame index is past the reader's progress.

Text in model weights is not a stored narrative atom. This specification does not claim to delete it. The assistant prompt may still forbid volunteering unread plot on the default path. That prompt rule is not the physical boundary.

## 14.4 Oracle

The leakage oracle for stored captions remains a caption-byte oracle. It covers captions actually placed in the prompt after frame rules and budget. It does not gain summary bytes or character-card bytes. Hash order is `chapter_number`, then `order_index`, then `tsid`. RAGAS v2 continues to hash raw captions only. The request fingerprint may record the visibility mode; that fingerprint is not the leakage oracle.

## 14.5 Limits that remain

* No server reading ledger is added, so the default path cannot prove the client progress was not raised.
* A valid assistant-message HMAC does not prove the generated prose contains no unread plot.
* User-typed text is not a sealed assistant atom.
* The exception's "whole work" is the ingested route set, not the complete literary source.

Fail-fast still applies to a missing progress index, a non-integer index, an index below `-1`, a scene that does not belong to the resolved work, and a `single_request` that fails the `questionId` check. Those states must not be repaired by widening the candidate set.
