# ADR-003: Multi-Provider AI Runtime Topology

## Context

### Current limitation

Scene Assistant generation currently depends on a single Gemini runtime path. Gemini outage, quota exhaustion, or transport instability can make generation unavailable.

The current topology therefore introduces a generation-layer SPOF.

---

### Specifically

1. Generation execution has no runtime failover capability.

2. Provider execution is directly coupled to the Gemini integration path.

3. Failover observability and provider-switch telemetry do not exist.

4. Production availability requirements and evaluation determinism requirements are different, but both currently depend on the same provider.

5. Hybrid RAG retrieval still contains an independent embedding SPOF outside the current HA scope.

6. Stream normalization responsibilities are currently split between AI SDK abstractions and browser-side SSE handling.

---

### Prior state

Current production runtime topology:

```text id="3wt35q"
@ai-sdk/google
    ↓
streamText()
    ↓
toUIMessageStreamResponse()
    ↓
SceneAssistant UI
```

Current characteristics:

* single-provider runtime
* no OpenRouter integration
* no runtime gateway abstraction
* no shared generation runtime abstraction layer
* no failover observability
* provider-pinned evaluation execution

Current UI boundaries already consume normalized semantic stream events (`text-delta`, `error`) rather than Gemini-native payloads.

---

### Need

The system requires operational high availability for generation runtime execution.

This ADR introduces constrained transparent failover for generation runtime execution only.

This ADR does NOT introduce:

* policy routing
* intelligent routing
* orchestration systems
* autonomous model selection
* retrieval redesign

---

### Constraints (from product and system requirements)

1. ADR-002 retrieval visibility boundaries MUST remain unchanged.

2. Phase 0 failover scope applies only to generation runtime execution.

3. Evaluation execution MUST remain provider-pinned and fail closed.

4. Failover MUST trigger only on operational/runtime failures.

5. Provider-native semantic payloads MUST NOT cross UI boundaries.

6. OpenRouter integration MUST remain a failover aggregation layer rather than a routing system.

7. ADR-002 serial retrieval topology MUST remain unchanged.

8. This ADR MUST NOT introduce embedding failover or retrieval failover.

---

## Decision

### Runtime topology

Adopt constrained transparent failover for generation runtime execution. Generation failover MUST NOT occur after semantic stream emission to the client has begun.

**Topology (mandatory):**

```text id="wy1kpj"
retrieveVerifiedAssistantContext
(outside failover scope)
            ↓
Gemini (primary provider)
            ↓ operational/runtime failure
OpenRouter (failover aggregation layer)
            ↓
fallback upstream models
```

Allowed failover triggers:

* upstream outage
* timeout
* quota exhaustion
* transport failure
* runtime exception

Forbidden failover triggers:

* hallucination suspicion
* semantic disagreement
* formatting dissatisfaction
* answer-style preference
* quality evaluation

This topology is availability-scoped.

This is NOT:

* policy routing
* capability routing
* quality-aware fallback
* orchestration

---

### Shared runtime abstraction (`AIModelProvider`)

Adopt a shared generation runtime abstraction:

```ts id="rlxg8g"
AIModelProvider
```

**Responsibilities:**

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

This abstraction applies only to generation runtime execution.

---

### Evaluation runtime rules

Evaluation correctness takes precedence over runtime availability.

**Mandatory constraints:**

* evaluation execution MUST remain provider-pinned
* automatic provider switching is forbidden
* transparent failover is forbidden
* evaluation execution MUST fail closed

Same-provider transient retry remains allowed.

Example:

```text id="n9o0v0"
Gemini RPM retry → allowed
Gemini → OpenRouter failover → forbidden
```

---

### Streaming contract normalization

Streaming normalization is divided into two layers.

#### Transport stream contract

Transport responsibilities include:

* UTF-8 decoding
* SSE parsing
* chunk buffering

Transport parsing may remain partially client-side during Phase 0.

#### Semantic stream contract

UI boundaries MUST consume normalized semantic stream events only.

Allowed semantic events:

```text id="ih6xwv"
text-delta
error
```

Provider-native semantic payloads MUST NEVER cross UI boundaries.

Transparent failover MUST preserve semantic stream compatibility across providers.

---

### Security constraints

Provider credentials MUST remain inside a server-only credential boundary.

**Mandatory constraints:**

* provider API keys forbidden in browser runtime
* provider adapters forbidden in client components
* provider credentials forbidden across UI boundaries
* provider execution restricted to server runtime only

OpenRouter integration MUST NOT weaken existing credential-boundary guarantees.

---

### End-to-end invariant

Transparent generation failover MUST preserve:

* ADR-002 retrieval visibility boundaries
* normalized semantic stream contracts
* provider-pinned evaluation determinism

Failover MUST remain observable at runtime boundaries while remaining transparent to end-user interaction flow.

---

## Alternatives

### Single-provider runtime

* **Definition:** Continue using Gemini as the sole generation provider.

* **Rejection:** Preserves a production SPOF and does not satisfy operational availability requirements.

---

### Policy-based routing

* **Definition:** Dynamically select providers using routing heuristics, capability scoring, or quality policies.

* **Rejection:** Introduces orchestration complexity outside the current availability-focused scope.

---

### Direct multi-vendor integration

* **Definition:** Integrate Gemini, Anthropic, DeepSeek, and other providers independently without an aggregation layer.

* **Rejection:** Increases credential-management complexity and operational overhead before runtime governance stabilizes.

Phase 0 prioritizes implementation simplicity over maximum infrastructure independence.

---

## Consequences

### Benefits

* Generation availability improves during provider-side operational failures.

* Failover events become observable through structured telemetry and provider metadata.

* Evaluation determinism remains protected through provider pinning and fail-closed execution.

* Runtime abstraction reduces direct provider coupling inside Scene Assistant generation runtime.

* ADR-002 retrieval visibility guarantees remain unchanged.

---

### Trade-offs

* Transparent failover may introduce provider-dependent semantic or stylistic drift.

* Production runtime behavior becomes less deterministic than evaluation runtime behavior.

* OpenRouter introduces aggregation-layer dependency risk.

* Runtime abstraction reduces provider-specific optimization opportunities.

* Generation failover does not eliminate embedding-layer SPOFs.

---

## Validation

The following validation requirements define target-state runtime conformance requirements for this ADR.

* **Failover trigger correctness:** Failover MUST trigger only on operational/runtime failures.

* **Forbidden failover behavior:** Quality dissatisfaction, semantic disagreement, or formatting preference MUST NEVER trigger provider switching.

* **Failover observability:** Provider-switch events MUST emit structured logs and preserve request correlation identifiers.

* **Evaluation fail closed:** Evaluation execution MUST reject cross-provider failover while permitting same-provider transient retry.

* **Semantic stream normalization:** Provider-native semantic payloads MUST NEVER cross UI boundaries.

* **ADR-002 boundary preservation:** Transparent failover MUST NOT alter retrieval visibility boundaries or candidate-universe semantics.

* **Embedding failover negative guarantee:** Embedding-layer failures MUST NOT trigger generation-provider failover.
  
* **Request correlation preservation:** Generation failover observability MUST preserve correlation with retrieval-layer request identifiers.

---

## Refs

Current implementation references:

* `src/app/api/scene-assistant/route.ts`
* `src/components/raree/SceneAssistant.tsx`
* `src/services/retrieval.ts`
* `eval/ragas/adapters/semantic-judge.ts`
* `eval/ragas/adapters/gemini-judge.ts`

Related specifications:

* `docs/specs/ragas-evaluation-suite.md`

Related ADRs:

* ADR-001: pgvector as vector store
* ADR-002: Hybrid RAG retrieval architecture

### Follow-up (granularity)

Potential future ADRs may include:

* embedding failover topology
* retrieval runtime redundancy
* provider-specific prompt normalization
* policy-based routing
* direct multi-vendor runtime integration