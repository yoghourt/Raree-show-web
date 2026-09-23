# ADR-003: Multi-Provider AI Runtime Topology

**Status:** Accepted

**Last Updated:** 2026-09-23

**Runtime authority:** `src/app/api/scene-assistant/route.ts`, `src/runtime/`

---

## Historical Note

The original ADR-003 was written when the multi-provider topology was in proposal stage. Runtime implementation was delivered and integrated ahead of ADR narrative update, creating a governance drift identified in the EAR review (2026-05-29). This revision re-aligns the ADR with shipped runtime truth while preserving the accepted architecture framing and documenting remaining expansion areas.

---

## Context

Scene Assistant generation originally depended on a single Gemini runtime path, creating a generation-layer SPOF. This ADR defines the accepted topology for transparent generation-layer failover.

This ADR covers generation-layer HA only. It does not cover:

* retrieval redesign
* embedding failover
* policy routing
* orchestration systems
* autonomous model selection

---

## 1. Current Runtime Truth

The following describes what exists in the repository and is wired into the production route today.

### Deployed generation path

```text
retrieveVerifiedAssistantContext
        ↓
executeVerifiedGeneration (src/runtime/fallback-coordinator.ts)
        ↓
Gemini (primary) → [OpenRouter (fallback, if OPENROUTER_API_KEY set)]
        ↓
wrapResponseWithSemanticStreamGuard
        ↓
ReadingRouteAssistant
```

### Deployed components

**`AIModelProvider` interface** (`src/runtime/types.ts`)

Defines the generation runtime contract: `streamText`, `generateText`, `normalizeError`, `providerId`.

**Gemini provider adapter** (`src/runtime/providers/gemini-provider.ts`)

Implements `AIModelProvider` over `@ai-sdk/google`. The scene-assistant route uses the adapter default `gemini-3.5-flash-lite`. Sets `maxRetries: 0` to reclaim retry ownership at coordinator level.

**OpenRouter provider adapter** (`src/runtime/providers/openrouter-provider.ts`)

Implements `AIModelProvider` over `@openrouter/ai-sdk-provider`. Default model is `OPENROUTER_MODEL_ID`, or `openai/gpt-oss-20b:free` when that variable is unset. Acts as failover aggregation layer only — not a routing system. The route passes `req.signal` into `executeVerifiedGeneration`. Abort is not a fallback trigger (ADR-013).

**Failover coordinator** (`src/runtime/fallback-coordinator.ts` → `executeVerifiedGeneration`)

Iterates `[primary, ...fallbackProviders]`. Catches provider errors, normalizes them, logs structured telemetry, and advances to the next provider before semantic lock. After semantic lock, fallover is forbidden.

**Stream orchestrator** (`src/runtime/stream-orchestrator.ts`)

Owns the pre-lock buffer phase. Throws on transport failure before first `text-delta`, allowing coordinator to attempt next provider.

**Semantic stream guard** (`src/runtime/semantic-stream-guard.ts`)

Wraps the locked response for continued downstream observation.

**Provider observability** (`src/runtime/provider-observability.ts`)

Emits structured logs: `provider_attempt_start`, `provider_attempt_failure`, `provider_fallback`, `semantic_stream_locked`, `[FALLBACK]`, `[SEMANTIC_LOCK]`, `[STREAM_OWNER]`.

### OpenRouter activation condition

OpenRouter failover is conditionally active: enabled when `OPENROUTER_API_KEY` is present in the server environment; absent key silently disables the fallback path. No behavior change when key is absent.

### Deployed security boundary

Provider credentials remain server-only (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`). Provider adapters are not used in client components. Provider-native semantic payloads do not cross UI boundaries.

### Evaluation runtime (deployed)

`npm run eval:ragas` pins one judge per run. The default is Gemini (`EVAL_JUDGE_PROVIDER` unset or `gemini`; model `EVAL_GEMINI_MODEL` or `gemini-2.5-flash`) with same-provider RPM retry. `EVAL_JUDGE_PROVIDER=openrouter` selects the OpenRouter judge instead. A run does not fail over from one judge to the other. This harness is not the Scene Assistant generation path.

---

## 2. Accepted Architecture

The following represents the accepted architectural topology. It is implemented in the repository and governs future development direction.

### Transparent failover topology

Generation failover is scoped to operational/runtime failures only. Failover MUST NOT trigger after semantic stream emission to the client has begun.

**Allowed failover triggers:**

* upstream outage
* timeout
* quota exhaustion
* transport failure before semantic lock

**Forbidden failover triggers:**

* hallucination suspicion
* semantic disagreement
* formatting dissatisfaction
* quality evaluation

### Provider abstraction scope

`AIModelProvider` is scoped exclusively to generation runtime execution. Forbidden scope expansions:

* retrieval orchestration
* embedding abstraction
* prompt orchestration
* memory systems
* agent runtime
* evaluation orchestration

### Invariant preservation

Transparent failover MUST preserve:

* ADR-002 retrieval visibility boundaries (unchanged — failover is post-retrieval only)
* normalized semantic stream contracts (`text-delta` and `error` events only at UI boundary)
* provider-pinned evaluation determinism

### Constraints (governance-binding)

1. ADR-002 retrieval visibility boundaries remain unchanged.
2. Failover scope applies only to generation runtime execution.
3. Evaluation execution remains provider-pinned and fail-closed.
4. Failover triggers only on operational/runtime failures.
5. Provider-native semantic payloads MUST NOT cross UI boundaries.
6. OpenRouter integration remains a failover aggregation layer, not a routing system.
7. ADR-002 serial retrieval topology remains unchanged.
8. This ADR does not introduce embedding failover or retrieval failover.

---

## 3. Remaining Expansion

The following areas remain unresolved or in active evolution. This section exists to prevent an "architecture complete" reading of this ADR.

* **OpenRouter production hardening:** `OPENROUTER_API_KEY` is optional today. Production rollout maturity — including key management, model selection governance, and fallback SLA — is not yet fully defined.
* **Default model governance:** `OPENROUTER_MODEL_ID` defaults to `openai/gpt-oss-20b:free`. Production model selection requires explicit governance decision.
* **Broader provider coverage:** Current topology covers Gemini → OpenRouter only. Direct multi-vendor integration, provider-specific prompt normalization, and extended fallback chains are future ADR scope.
* **Telemetry evolution:** Structured logs exist (`provider-observability.ts`) but are not yet connected to an observability backend or alerting pipeline.
* **Embedding failover:** Query embedding remains a separate Gemini REST path (`src/services/retrieval.ts`) with no failover. Outside generation HA scope; requires a separate ADR.
* **Governance hardening:** Runtime convergence between accepted architecture and production deployment posture is ongoing.

---

## Alternatives (unchanged)

### Single-provider runtime

Continue using Gemini as sole generation provider. Rejected for HA target goals — preserves a generation-layer SPOF.

### Policy-based routing

Dynamically select providers using routing heuristics or quality policies. Rejected — introduces orchestration complexity outside availability scope.

### Direct multi-vendor integration

Integrate multiple providers independently without an aggregation layer. Rejected for Phase 0 — increases credential-management complexity before runtime governance stabilizes.

---

## Refs

### Deployed

* `src/app/api/scene-assistant/route.ts`
* `src/runtime/types.ts`
* `src/runtime/fallback-coordinator.ts`
* `src/runtime/stream-orchestrator.ts`
* `src/runtime/semantic-stream-guard.ts`
* `src/runtime/provider-observability.ts`
* `src/runtime/providers/gemini-provider.ts`
* `src/runtime/providers/openrouter-provider.ts`
* `src/components/raree/ReadingRouteAssistant.tsx`
* `src/services/retrieval.ts` (embedding SPOF; outside generation failover scope)

### Design anchors

* `docs/specs/adr-003-implementation-plan.md`
* `docs/specs/adr-003-phase-2-fallback.md`
* ADR-001: pgvector as vector store
* ADR-002: Hybrid RAG retrieval architecture
