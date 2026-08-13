# ADR-013: Scene Assistant Cancellation Semantics

**Status:** Accepted

**Type:** Architecture ADR

**Version:** v0.1

**Last Updated:** 2026-08-13

**Owner:** Architect

**Runtime authority:** `src/app/api/scene-assistant/route.ts`, `src/runtime/`

**Related ADR:** ADR-003 (Multi-Provider AI Runtime Topology) — complementary; this ADR does not revise ADR-003 historical conclusions.

---

## Historical Note

Scene Assistant generation originally had a streaming UI without a defined cancellation lifecycle. Client disconnect could stop token presentation while provider generation continued. EAR-SCENE-ASSISTANT-STREAMING established that “UI stopped receiving” is not “backend generation stopped.” IMPLEMENT-SCENE-ASSISTANT-CANCEL-001 then wired request abort into the generation lifecycle. This ADR records the resulting architectural decision: Cooperative Cancellation.

This ADR is Accepted after Architect Review. Local runtime probe evidence exists. Production / Vercel cancellation is not verified and is not claimed.

---

## Context

Scene Assistant generation is a multi-layer lifecycle:

```text
UI trigger
  → client fetch / ReadableStream reader
    → POST /api/scene-assistant
      → executeVerifiedGeneration
        → orchestrateProviderStream
          → AIModelProvider.streamText
            → AI SDK streamText
              → upstream provider fetch
```

Without an explicit cancellation decision, later UI, runtime, provider, fallback, and observability work can interpret “Cancel / Stop” differently:

* UI presentation stop only
* request abort without generation abort
* generation abort misclassified as provider failure
* abort treated as a pre-lock operational failure and used to trigger fallback

ADR-003 already forbids failover after semantic lock and restricts failover to operational/runtime failures. It does not define cancellation semantics. Leaving cancellation undefined would pressure ADR-003’s fallback boundary.

### Need

Scene Assistant must have one authoritative meaning of Cancel: a generation-lifecycle signal that owned execution layers receive and respect, not a UI presentation state.

### Authority boundary

This ADR is a consumer-repository Architecture ADR. It specializes Scene Assistant generation cancellation. It does not:

* redefine constitutional hierarchy
* create new constitutional invariants
* weaken Semantic Lock or Pre-Lock Fallback Boundary (`FOUNDATION.md`)
* revise ADR-002 Serial Pipeline
* revise ADR-003 failover topology

Cancellation invariants below are Scene Assistant generation-lifecycle constraints. They do not escalate to constitutional invariants in this document.

---

## Decision

Scene Assistant cancellation is **Cooperative Cancellation**, not **UI-only Stop**.

Cancellation is a **Generation Lifecycle Runtime Signal**, not a UI presentation state.

When cancellation is triggered, every execution layer that belongs to this generation lifecycle and owns a cancellation boundary MUST receive and respect the cancellation signal.

Cancellation MUST propagate downward to the actual generation / provider execution boundary.

Provider generation MUST receive the cancellation signal.

Cancellation MUST NOT be interpreted as ordinary provider failure.

Cancellation MUST NOT trigger provider fallback.

Cancellation MUST NOT be recorded as ordinary generation failure.

After an execution layer has observed cancellation, it MUST NOT continue normal output production for this generation.

### Cooperative boundary

“Cooperative” does **not** promise instantaneous, forced, physical kill of every external system.

It means:

* cancellation signal has explicit ownership
* the signal MUST propagate to controlled execution layers
* those layers MUST stop work that is no longer required
* cancellation MUST NOT be converted into ordinary failure
* cancellation MUST NOT start fallback generation
* cancellation MUST preserve generation-lifecycle semantic consistency

UI state alone is not evidence that backend or provider generation has stopped.

---

## Invariants

| ID | Constraint |
| --- | --- |
| C1 | Cancellation is a lifecycle signal, not a UI presentation state. |
| C2 | Cancellation MUST propagate from request lifecycle to generation execution. |
| C3 | Provider generation MUST receive the cancellation signal. |
| C4 | Cancellation MUST NOT trigger provider fallback. |
| C5 | Cancellation MUST NOT be represented as provider failure. |
| C6 | A cancelled generation MUST NOT continue normal output production after cancellation has been observed. |
| C7 | UI state MUST NOT be treated as evidence that backend / provider generation has stopped. |

These invariants apply to Scene Assistant generation only. They do not change ADR-002 retrieval topology or ADR-003 provider-switch rules, except to classify cancellation as **not** a fallback trigger.

---

## Current Runtime Truth

The following is verified local runtime behavior. It is evidence for this decision, not a SPEC and not a production/Vercel claim.

### Verified cancellation path

```text
client fetch.abort() / reader.cancel()
  → POST /api/scene-assistant `req.signal`
    → executeVerifiedGeneration({ abortSignal })
      → orchestrateProviderStream(..., abortSignal)
        → provider.streamText({ abortSignal })
          → AI SDK streamText({ abortSignal })
            → upstream fetch abort
```

### Verified facts

1. `POST /api/scene-assistant` `req.signal` is triggered by client `fetch.abort()` and by `reader.cancel()`.
2. `req.signal` propagates along the path above into AI SDK generation.
3. Gemini and OpenRouter: client abort → request signal aborted → upstream `AbortError` / `ResponseAborted` → normal upstream `body_done` does not occur on the active generation fetch.
4. `semantic-stream-guard` no longer calls `body.cancel()` on a reader-locked upstream body; cancel uses the held `ReadableStreamDefaultReader.cancel()` path. The locked-body cancellation error is gone.
5. Cancellation does not trigger provider fallback. Pre-lock abort is isolated from the fallback chain.
6. Semantic lock / provider ownership remains intact on both normal streaming and cancellation paths.
7. Normal progressive streaming regression passed.
8. If abort is not performed, an old generation may continue after UI remount. UI stop alone is not Runtime Cancellation (C7).

### Explicitly unverified

* Vercel / production deployment cancellation support
* instantaneous physical termination of every upstream vendor resource beyond the abort signal boundary
* Stop UI interaction
* cancelled / partial / failed product state machine
* observability schema fields for cancellation vs failure

AI SDK may compose an internal abort signal from `req.signal` (`abortSignal` identity need not equal `req.signal`). Cooperative Cancellation requires that generation receive a derived cancellation signal, not signal-object identity.

---

## Relation to ADR-003

ADR-003 remains the authority for generation-layer HA:

* failover is operational/runtime only
* failover is forbidden after semantic lock
* OpenRouter is a failover aggregation layer, not a router

This ADR adds a complementary classification: **cancellation is not an operational provider failure and MUST NOT enter the fallback chain**, before or after semantic lock.

This is not a silent rewrite of ADR-003. ADR-003’s historical failover trigger list is unchanged. Cancellation is defined here so it cannot be mistaken for an allowed failover trigger.

---

## Relation to Runtime Truth V1

This ADR primarily advances:

* **C — Runtime Stability**

It also provides a stable cancellation lifecycle foundation for:

* **D1 — Complete Reading Experience**

It does not define D1 product UX.

---

## Scope

This ADR defines Scene Assistant cancellation architecture semantics and long-lived constraints only.

This ADR does **not** define:

* Stop UI interaction
* cancelled / partial / failed final UI state machine
* partial-response product semantics
* Vercel cancellation deployment verification
* OpenRouter retry policy
* `maxDuration` / timeout policy
* provider-specific cancellation implementation details
* observability schema fields
* a new cancellation API endpoint

Those remain later independent decisions or implementation work.

---

## Alternatives considered

### UI-only Stop

Stop rendering / stop reading the client stream, without treating cancel as a generation-lifecycle signal.

Rejected: probe evidence showed remounted UI can leave provider generation running. This violates C1, C2, C6, and C7, and makes fallback / observability interpretation non-deterministic.

### Treat cancel as provider failure and fallback

Normalize abort as timeout / transport failure and attempt the next provider.

Rejected: creates a second generation after the user cancelled, burns quota, and collides with ADR-003 semantic-lock / pre-lock fallback ownership. Violates C4 and C5.

### Forced physical kill of all upstream systems

Promise instantaneous, vendor-wide process kill beyond cooperative abort signals.

Rejected: not a supportable runtime guarantee. Cooperative Cancellation stops owned execution and propagates abort; it does not invent unobservable vendor kill semantics.

---

## Consequences

* Future Scene Assistant UI (including any Stop control) MUST drive or observe Runtime Cancellation, not only local presentation state.
* Fallback coordinator MUST keep cancellation outside provider-failure classification.
* Observability, when defined, MUST distinguish cancellation from provider failure; schema is out of scope here.
* Provider adapters MUST continue to accept and forward cancellation into AI SDK generation.
* Production/Vercel cancellation remains an unverified deployment slice; this ADR must not be read as Runtime-Enforced in production until that evidence exists.
* A later SPEC may define stable contracts for Stop UI, terminal state, or observability where such contracts are required; implementation must remain consistent with this ADR.

---

## Evidence

| Claim | Source |
| --- | --- |
| UI stop ≠ backend stop; request path and state-machine gaps | EAR-SCENE-ASSISTANT-STREAMING |
| `fetch.abort()` / `reader.cancel()` → `req.signal.aborted`; upstream abort vs `body_done` | EAR-SCENE-ASSISTANT-STREAMING §K Runtime Abort Probe (local Next.js; Gemini + OpenRouter) |
| `req.signal` wired into generation; guard uses held `reader.cancel()`; abort excluded from fallback; streaming regression | IMPLEMENT-SCENE-ASSISTANT-CANCEL-001 |
| Gemini upstream abort reached; no normal post-abort `body_done` | §K probe: `fetch.abort` / `reader.cancel` on Gemini |
| OpenRouter upstream abort reached; no normal post-abort `body_done` on active generation fetch | §K probe: `fetch.abort` / `reader.cancel` on OpenRouter |
| Locked-body `ReadableStream is locked` cancel error gone | IMPLEMENT-SCENE-ASSISTANT-CANCEL-001 + post-fix §K probe |
| Cancellation does not trigger provider fallback | IMPLEMENT-SCENE-ASSISTANT-CANCEL-001 (`abortSignal.aborted` isolated from fallback) |
| Normal progressive streaming regression PASS | §K probe control scenarios (Gemini + OpenRouter) |
| Unabortable remount can leave old generation running | EAR-SCENE-ASSISTANT-STREAMING; §K concurrent/orphan observation |
| Production / Vercel cancellation | **Not verified. Not claimed.** |

Probe harness used for §K was temporary instrumentation and is not retained as a committed test suite.

---

## Refs

* Governance: `FOUNDATION.md` (runtime supremacy; Semantic Lock; Pre-Lock Fallback Boundary)
* Governance: `ADR_RULES.md` (Architecture ADR lifecycle; Accepted status; no silent ADR rewrite)
* Governance: `DOCUMENT_NAMING_CONVENTION.md`
* Governance: `STREAMING.md` (v1 placeholder; no additional streaming constitution claimed)
* ADR-003: `docs/adr/003-multi-provider-ai-runtime.md`
* Spec (unchanged): `docs/specs/adr-003-phase-2-fallback.md`
* Runtime: `src/app/api/scene-assistant/route.ts`
* Runtime: `src/runtime/fallback-coordinator.ts`
* Runtime: `src/runtime/stream-orchestrator.ts`
* Runtime: `src/runtime/semantic-stream-guard.ts`
* Runtime: `src/runtime/types.ts`
* Runtime: `src/runtime/providers/gemini-provider.ts`
* Runtime: `src/runtime/providers/openrouter-provider.ts`
