# ADR-003: Multi-Provider AI Runtime Topology

**Status:** Proposed (target state) — **not deployed**

**Runtime authority:** `src/app/api/scene-assistant/route.ts`, `src/components/raree/SceneAssistant.tsx`

---

## Context

### Current limitation

Scene Assistant generation depends on a single Gemini runtime path. Gemini outage, quota exhaustion, or transport instability can make generation unavailable.

The deployed topology therefore has a generation-layer SPOF.

### Specifically

1. Generation execution has no runtime failover capability.
2. Provider execution is directly coupled to the Gemini integration path.
3. Failover observability and provider-switch telemetry do not exist.
4. Production availability requirements and evaluation determinism requirements differ, but both currently depend on the same provider.
5. Hybrid RAG retrieval contains an independent embedding SPOF outside generation HA scope.
6. Stream normalization responsibilities are split between AI SDK abstractions and browser-side SSE handling.

### Need

The system requires operational high availability for generation runtime execution.

This ADR **proposes** constrained transparent failover for generation runtime execution only.

This ADR does **not** propose:

* policy routing
* intelligent routing
* orchestration systems
* autonomous model selection
* retrieval redesign

---

## Runtime Truth (deployed)

The following describes the **current production** Scene Assistant generation path. None of the target-state components below exist in the repository today.

### Generation path

```text
retrieveVerifiedAssistantContext
        ↓
@ai-sdk/google → streamText(gemini-3-flash-preview)
        ↓
toUIMessageStreamResponse()
        ↓
SceneAssistant UI
```

### Deployed characteristics

* **Single generation provider:** Gemini via `@ai-sdk/google` and `streamText()` in `src/app/api/scene-assistant/route.ts`.
* **No provider abstraction:** No `AIModelProvider` interface or equivalent generation abstraction exists in `src/`.
* **No runtime failover:** A single `streamText()` call; failures return HTTP 502. No fallback provider path.
* **No OpenRouter integration:** No dependency, environment variable, or code reference.
* **Embedding SPOF (retrieval):** Query embedding uses a separate Gemini REST path (`embedQuery` in `src/services/retrieval.ts`). This is outside generation HA scope and has no failover.
* **Normalized semantic stream (UI):** The client consumes `text-delta` and `error` events only (`SceneAssistant.tsx`). Transport SSE parsing remains partially client-side.
* **Eval (provider-pinned):** Offline RAGAS judges use Gemini only (`eval/ragas/adapters/gemini-judge.ts`) with same-provider RPM retry (`judge-rate-limit.ts`). Cross-provider failover is neither implemented nor permitted.
* **Observability today:** RAG ingress logging and production-oracle failure logs. **No** provider-switch or provider-health routing telemetry.

### Deployed security boundary

Provider credentials remain server-only (`GEMINI_API_KEY`). Provider adapters are not used in client components.

---

## Future Target Topology (proposed; when implemented)

The sections below define the **target state** for generation-layer HA. They are **not deployed**. Requirements use **when implemented** scope unless noted as already satisfied by the deployed runtime.

### Constraints (when implemented)

1. ADR-002 retrieval visibility boundaries SHALL remain unchanged.
2. Phase 0 failover scope SHALL apply only to generation runtime execution.
3. Evaluation execution SHALL remain provider-pinned and fail closed.
4. Failover SHALL trigger only on operational/runtime failures.
5. Provider-native semantic payloads SHALL NOT cross UI boundaries (already enforced in deployed UI contract).
6. OpenRouter integration SHALL remain a failover aggregation layer, not a routing system.
7. ADR-002 serial retrieval topology SHALL remain unchanged.
8. This ADR SHALL NOT introduce embedding failover or retrieval failover.

---

### Target generation topology (when implemented)

**Proposed:** adopt constrained transparent failover for generation runtime execution. Generation failover SHALL NOT occur after semantic stream emission to the client has begun.

**Target topology:**

```text
retrieveVerifiedAssistantContext
(outside failover scope)
            ↓
Gemini (primary provider)
            ↓ operational/runtime failure
OpenRouter (failover aggregation layer)
            ↓
fallback upstream models
```

**Allowed failover triggers (when implemented):**

* upstream outage
* timeout
* quota exhaustion
* transport failure
* runtime exception

**Forbidden failover triggers (when implemented):**

* hallucination suspicion
* semantic disagreement
* formatting dissatisfaction
* answer-style preference
* quality evaluation

This topology is availability-scoped. It is **not** policy routing, capability routing, quality-aware fallback, or orchestration.

---

### Proposed abstraction (`AIModelProvider`) — not in repository

**Proposed:** a shared generation runtime abstraction:

```ts
AIModelProvider
```

**Responsibilities (when implemented):**

* generation execution
* streaming execution
* normalized runtime errors
* provider metadata
* telemetry metadata

**Forbidden scope expansion:**

* retrieval orchestration
* embedding abstraction
* prompt orchestration
* memory systems
* agent runtime
* evaluation orchestration

This abstraction SHALL apply only to generation runtime execution.

---

### Evaluation runtime rules

Evaluation correctness takes precedence over runtime availability.

**Deployed today:**

* Evaluation uses Gemini only with same-provider transient RPM retry.
* Cross-provider failover is not implemented.

**Mandatory constraints (when implemented for eval):**

* evaluation execution SHALL remain provider-pinned
* automatic provider switching SHALL be forbidden
* transparent failover SHALL be forbidden for evaluation
* evaluation execution SHALL fail closed

Same-provider transient retry remains allowed.

Example:

```text
Gemini RPM retry → allowed
Gemini → OpenRouter failover → forbidden
```

---

### Streaming contract normalization

Streaming normalization is divided into two layers.

#### Transport stream contract

Transport responsibilities include UTF-8 decoding, SSE parsing, and chunk buffering.

Transport parsing may remain partially client-side during Phase 0 (current deployed behavior).

#### Semantic stream contract

UI boundaries consume normalized semantic stream events only (deployed today).

Allowed semantic events:

```text
text-delta
error
```

Provider-native semantic payloads SHALL NEVER cross UI boundaries.

When implemented, transparent failover SHALL preserve semantic stream compatibility across providers.

---

### Security constraints (when implemented)

Provider credentials SHALL remain inside a server-only credential boundary.

**Mandatory constraints:**

* provider API keys forbidden in browser runtime
* provider adapters forbidden in client components
* provider credentials forbidden across UI boundaries
* provider execution restricted to server runtime only

OpenRouter integration SHALL NOT weaken existing credential-boundary guarantees.

---

### End-to-end invariant (when implemented)

When implemented, transparent generation failover SHALL preserve:

* ADR-002 retrieval visibility boundaries
* normalized semantic stream contracts
* provider-pinned evaluation determinism

Failover SHALL remain observable at runtime boundaries while remaining transparent to end-user interaction flow.

---

## Alternatives

### Single-provider runtime

* **Definition:** Continue using Gemini as the sole generation provider.
* **Rejection (for target availability goals):** Preserves a generation-layer SPOF and does not satisfy operational availability requirements. This is the **deployed** state today; rejection applies to the proposed HA target, not because multi-provider is already live.

### Policy-based routing

* **Definition:** Dynamically select providers using routing heuristics, capability scoring, or quality policies.
* **Rejection:** Introduces orchestration complexity outside the availability-focused scope.

### Direct multi-vendor integration

* **Definition:** Integrate Gemini, Anthropic, DeepSeek, and other providers independently without an aggregation layer.
* **Rejection:** Increases credential-management complexity and operational overhead before runtime governance stabilizes.

Phase 0 prioritizes implementation simplicity over maximum infrastructure independence.

---

## Consequences

### Deployed trade-offs (today)

* Generation availability depends on a single Gemini path.
* Embedding for retrieval depends on a separate Gemini REST path with no failover.
* No provider-switch observability for operations.
* Eval and production share the same vendor; eval remains provider-pinned with same-provider retry only.

### Expected effects when target state is implemented

* Generation availability would improve during provider-side operational failures.
* Failover events would become observable through structured telemetry and provider metadata.
* Evaluation determinism would remain protected through provider pinning and fail-closed execution.
* A runtime abstraction would reduce direct provider coupling inside Scene Assistant generation.
* ADR-002 retrieval visibility guarantees would remain unchanged.

### Trade-offs of target state

* Transparent failover may introduce provider-dependent semantic or stylistic drift.
* Production runtime behavior would become less deterministic than evaluation runtime behavior.
* OpenRouter would introduce aggregation-layer dependency risk.
* Runtime abstraction would reduce provider-specific optimization opportunities.
* Generation failover would not eliminate embedding-layer SPOFs.

---

## Target-state validation (when implemented)

The following requirements define conformance for the **proposed** topology. They do **not** describe deployed behavior.

* **Failover trigger correctness:** Failover SHALL trigger only on operational/runtime failures.
* **Forbidden failover behavior:** Quality dissatisfaction, semantic disagreement, or formatting preference SHALL NEVER trigger provider switching.
* **Failover observability:** Provider-switch events SHALL emit structured logs and preserve request correlation identifiers.
* **Evaluation fail closed:** Evaluation execution SHALL reject cross-provider failover while permitting same-provider transient retry.
* **Semantic stream normalization:** Provider-native semantic payloads SHALL NEVER cross UI boundaries.
* **ADR-002 boundary preservation:** Transparent failover SHALL NOT alter retrieval visibility boundaries or candidate-universe semantics.
* **Embedding failover negative guarantee:** Embedding-layer failures SHALL NOT trigger generation-provider failover.
* **Request correlation preservation:** Generation failover observability SHALL preserve correlation with retrieval-layer request identifiers.

---

## Refs

### Deployed

* `src/app/api/scene-assistant/route.ts`
* `src/components/raree/SceneAssistant.tsx`
* `src/services/retrieval.ts` (embedding SPOF; outside generation failover scope)
* `src/lib/gemini-proxy-fetch.ts`
* `eval/ragas/adapters/semantic-judge.ts`
* `eval/ragas/adapters/gemini-judge.ts`
* `eval/ragas/adapters/judge-rate-limit.ts`

### Target-state design anchors

* `docs/specs/ragas-evaluation-suite.md`
* ADR-001: pgvector as vector store
* ADR-002: Hybrid RAG retrieval architecture

### Follow-up (granularity)

Potential future ADRs may include:

* embedding failover topology
* retrieval runtime redundancy
* provider-specific prompt normalization
* policy-based routing
* direct multi-vendor runtime integration
