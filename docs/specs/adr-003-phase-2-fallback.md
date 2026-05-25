# ADR-003 Phase 2 Semantic Stream Ownership & Deterministic Pre-Lock Fallback

# 1. Context

## 1.1 Current Runtime Topology

Current generation flow:

```text
SceneAssistant.tsx
  → /api/scene-assistant
  → route.ts
  → executeVerifiedGeneration()
  → provider.streamText()
  → AI SDK streamText()
  → toUIMessageStreamResponse()
  → client
````

The current runtime delegates client-visible SSE ownership directly to the AI SDK.

---

## 1.2 Verified Runtime Truth

EAR-2 runtime analysis confirmed the following lifecycle behavior.

> **EAR-2 Addendum (2026-05-25 — Production Validation):**
> §A and §C below have been refined based on production observation.
> See §14 for the full correction record.

---

### A. `streamText()` bootstrap is partially eager

~~AI SDK `streamText()` returns synchronously before provider transport execution begins.~~

**Corrected:** AI SDK stream bootstrap is partially eager and partially deferred.

`provider.streamText()` may throw terminal exceptions (e.g. `AI_RetryError`) before
the stream lifecycle begins, if the provider transport fails during bootstrap.

This is the **Bootstrap Exception Path** — distinct from the Stream Error Event Path
described in §C.

---

### B. HTTP/SSE lifecycle begins before provider transport completion

`toUIMessageStreamResponse()` creates and returns an HTTP 200 SSE Response before Gemini transport success is verified.

---

### C. Gemini provider failures may surface through two distinct runtime paths

~~HTTP 429 / quota exhaustion errors occur after the SSE response lifecycle already exists.~~
~~The AI SDK converts provider transport failures into stream error chunks instead of rejected promises.~~

**Corrected:** Provider failures surface through two distinct paths:

**Path 1 — Bootstrap Exception Path**

* Provider bootstrap fails before the stream lifecycle begins
* Failure surfaces as a thrown JavaScript exception (`AI_RetryError`, `AI_APICallError`)
* No SSE response is created
* Deterministic fallback fully supported via coordinator `try/catch`

**Path 2 — Stream Error Event Path**

* HTTP 200 SSE lifecycle is already established
* Failure surfaces as an SSE `error` event in the response body
* Orchestrator intercepts this event in the pre-lock buffer phase
* Fallback permitted only before semantic lock

**Production observation:** Gemini quota exhaustion (HTTP 429 / `RESOURCE_EXHAUSTED`)
primarily surfaces through the Bootstrap Exception Path (`AI_RetryError`), not as
SSE stream error chunks.

---

### D. Current fallback coordinator cannot observe transport failures before Response commit

Current coordinator `try/catch` only surrounds synchronous stream handle creation.

It does not own provider transport lifecycle execution.

---

# 2. Problem Statement

The runtime currently lacks semantic stream ownership control.

The existing topology delegates client-visible stream lifecycle ownership directly to the AI SDK, preventing deterministic provider fallback when transport failures occur before semantic token emission.

As a result:

* Gemini quota exhaustion cannot be safely intercepted
* deterministic fallback cannot be guaranteed
* provider ownership becomes coupled to premature SSE lifecycle creation

---

# 3. Architectural Reframing

## 3.1 Semantic Continuity vs HTTP Lifecycle

This ADR introduces a new architectural distinction:

> HTTP/SSE lifecycle ownership is NOT equivalent to semantic continuity ownership.

The runtime must define stream ownership using semantic visibility, not HTTP response existence.

---

## 3.2 Semantic Continuity Definition

Semantic continuity begins at the first client-visible semantic token emission (`text-delta`).

Before semantic continuity begins:

* provider ownership remains mutable
* deterministic fallback remains permitted

After semantic continuity begins:

* stream ownership becomes immutable
* provider switching becomes permanently forbidden

---

# 4. Runtime Invariants

## Invariant A — Semantic Lock

Once the first client-visible semantic token is emitted, stream ownership becomes immutable.

```text
semantic_stream_locked === true
→ provider ownership immutable
```

---

## Invariant B — Fallback Boundary

Fallback is permitted only before semantic stream lock.

```text
semantic_stream_locked === false
→ fallback allowed
```

---

## Invariant C — Mid-stream Provider Switching Forbidden

Provider switching after semantic lock is strictly forbidden.

Reasons:

* semantic drift risk
* duplicated token ownership
* inconsistent narrative continuity
* corrupted stream guarantees

---

## Invariant D — Semantic Ownership Supersedes Response Ownership

Fallback eligibility is determined by semantic visibility, not by HTTP Response existence.

---

# 5. Stream State Machine

## 5.1 Runtime States

```text
BOOTSTRAP
→ WARMUP
→ LOCK_PENDING
→ LOCKED
→ STREAMING
→ COMPLETE
→ ERROR
```

---

## 5.2 State Definitions

### BOOTSTRAP

Description:

* provider selected
* internal stream initialized
* no client-visible emission

Fallback:

* allowed

---

### WARMUP

Description:

* provider transport preparing
* AI SDK internal events allowed
* `start`
* `start-step`

No semantic token emission allowed.

Fallback:

* allowed

---

### LOCK_PENDING

Description:

* provider transport active
* awaiting first semantic token

Fallback:

* allowed

---

### LOCKED

Trigger:

* first `text-delta`

Effects:

```text
semantic_stream_locked = true
stream_owner_locked = true
```

Fallback:

* forbidden

---

### STREAMING

Description:

* semantic continuity active
* stream ownership immutable

Fallback:

* forbidden

---

### COMPLETE

Description:

* normal stream completion

---

### ERROR

Description:

* terminal stream failure

Behavior:

* no continuation allowed
* no provider reassignment allowed

---

# 6. Revised Runtime Topology

## 6.1 Current (Rejected)

```text
provider
→ AI SDK SSE response
→ client
```

Problem:

* provider transport lifecycle hidden
* early transport failures unobservable
* deterministic fallback impossible

---

## 6.2 Proposed

```text
provider stream
  ↓
internal orchestration stream
  ↓
semantic lock detector
  ↓
client-visible SSE response
```

---

# 7. Internal Orchestration Boundary

## 7.1 Purpose

Introduce a runtime-controlled orchestration layer before client-visible semantic emission.

The runtime must temporarily own stream coordination before semantic lock.

---

## 7.2 Responsibilities

### A. Internal Event Buffering

The orchestration layer buffers provider stream events before semantic lock.

---

### B. Semantic Lock Detection

The orchestration layer detects first semantic token emission (`text-delta`).

---

### C. Deterministic Pre-Lock Fallback

The orchestration layer may discard provider streams before semantic lock and switch providers deterministically.

---

### D. Stream Ownership Freeze

After semantic lock:

```text
stream_owner_locked = true
```

No fallback may occur afterwards.

---

# 8. Fallback Semantics

## 8.1 Allowed Fallback Conditions

| Condition                  | Fallback Allowed |
| -------------------------- | ---------------- |
| HTTP 429                   | Yes              |
| quota exceeded             | Yes              |
| resource exhausted         | Yes              |
| invalid credential         | Yes              |
| provider bootstrap failure | Yes              |

---

## 8.2 Forbidden Fallback Conditions

| Condition                        | Fallback Allowed |
| -------------------------------- | ---------------- |
| timeout after semantic lock      | No               |
| partial semantic stream emitted  | No               |
| provider failure after lock      | No               |
| post-lock transport interruption | No               |
| stream corruption after lock     | No               |

---

# 9. OpenRouter Integration Scope

## 9.1 Phase 2 Goal

Phase 2 introduces OpenRouter as a deterministic fallback provider.

The runtime SHALL:

* attempt Gemini first
* fallback to OpenRouter before semantic lock
* permanently lock ownership after first semantic token

---

## 9.2 Narrow Provider Contract

`AIModelProvider` remains intentionally narrow.

Phase 2 does NOT normalize:

* provider-native metadata
* tool calling semantics
* provider-specific streaming cadence
* token accounting semantics

---

# 10. Observability Contract

## 10.1 Required Logs

### Fallback

```text
[FALLBACK] Primary provider failed. Switched to OpenRouter. RequestId: ${requestId}
```

---

### Semantic Lock

```text
[SEMANTIC_LOCK] Stream ownership locked. RequestId: ${requestId}
```

---

### Stream Owner

```text
[STREAM_OWNER] Provider locked: gemini/openrouter
```

---

## 10.2 Structured Metadata

Recommended metadata fields:

```text
request_id
provider_name
fallback_reason
model_id
semantic_lock_state
attempt_index
```

---

# 11. Non-Goals

This phase does NOT introduce:

* speculative parallel streaming
* weighted provider routing
* provider scoring
* transport replay
* provider normalization
* generic orchestration platform
* mid-stream continuation
* semantic reconstruction after lock

---

# 12. Known Debt

## Debt A — No Post-Lock Recovery

The runtime intentionally rejects recovery after semantic lock.

---

## Debt B — Provider Semantics Remain Divergent

Provider-specific streaming behavior remains partially unnormalized.

---

## Debt C — Additional Stream Coordination Complexity

Internal orchestration buffering introduces additional runtime coordination complexity.

---

## Debt D — AI SDK Transport Dependency

The runtime still depends on AI SDK provider transport semantics.

---

# 14. Production Validation Record

## 14.1 Validation Event

Date: 2026-05-25

Trigger: Real Gemini `gemini-2.5-pro` quota exhaustion during local production run.

---

## 14.2 Observed Runtime Behavior

Fallback path activated correctly:

```text
RAG retrieval succeeded (embedContent quota unaffected)
provider.streamText() → AI_RetryError thrown (BOOTSTRAP phase)
coordinator catch() → rate_limit classified
[FALLBACK] logged → OpenRouter activated
[SEMANTIC_LOCK] + [STREAM_OWNER] → openrouter
HTTP 200 returned to client
```

---

## 14.3 EAR-2 Corrections

### Correction 1 — AI SDK is not fully lazy

EAR-2 original:
> `streamText()` returns synchronously before provider transport execution begins.

Corrected:
> AI SDK stream bootstrap is **partially eager**.  `provider.streamText()` may throw
> before returning a `TextStreamHandle` if the provider transport fails during bootstrap.

### Correction 2 — Gemini 429 primary path is Bootstrap, not Stream

EAR-2 original:
> Gemini quota/rate-limit failures surface during stream consumption.
> The AI SDK converts provider transport failures into stream error chunks.

Corrected:
> Gemini quota exhaustion primarily surfaces as `AI_RetryError` thrown from the
> bootstrap phase, not as SSE error chunks.  The Stream Error Event Path (§1.2 C
> Path 2) covers a separate class of failures and remains valid defense-in-depth.

---

## 14.4 Architectural Corrections Applied

### maxRetries: 0 — Runtime Ownership Reclamation

AI SDK's built-in provider-level retry (`maxRetries: 2` default) conflicts with
ADR-003 ownership semantics:

```text
AI SDK retry semantics:  "retry is good"
ADR-003 ownership:       "fail fast before semantic lock"
```

Setting `maxRetries: 0` in `gemini-provider.ts` reclaims retry/fallback policy
ownership at the coordinator layer, eliminating ~10s per retry-attempt latency
before OpenRouter fallback activates.

This is an **architecture correction**, not a performance tweak.

---

## 14.5 SSE Error Interception Layer — Justified as Defense-in-Depth

The pre-lock SSE error event parser in `stream-orchestrator.ts` is retained.

Rationale:
* Provider behavior may change across AI SDK or Gemini API versions
* Stream Error Event Path (HTTP 200 + SSE error body) is a real failure surface
* Removing the parser would re-introduce uncovered failure surfaces

The orchestration layer intentionally preserves pre-lock stream error interception
even when bootstrap-level fallback already exists.

This redundancy is intentional defense-in-depth.

---

## 14.6 ADR-003 Architecture Status After Validation

ADR-003 Phase 2 has evolved from:

```text
quota fallback architecture
```

to:

```text
multi-surface semantic failure governance
```

Core runtime abstraction confirmed stable. Phase 2 is frozen.

---

# 13. Migration Scope

Phase 2 ONLY affects:

* generation runtime
* provider orchestration boundary
* semantic stream ownership lifecycle
* deterministic fallback semantics

Phase 2 does NOT affect:

* ADR-002 oracle enforcement
* retrieval embedding pipeline
* evaluation judge runtime
* spoiler boundary logic
