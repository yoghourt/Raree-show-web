# ADR-003 Implementation Plan

## Title

ADR-003 Runtime Multi-Provider Fallback Architecture — Implementation Plan

---

# 1. Context

ADR-003 introduces runtime-level provider redundancy for the Scene Assistant inference pipeline.

The objective is NOT:

* abstract AI vendors into a universal SDK
* normalize every provider capability
* create provider-agnostic feature parity

The objective IS:

* maintain runtime availability during provider degradation
* preserve deterministic retrieval / oracle boundaries
* isolate provider failure domains
* maintain observability during fallback execution

This document defines:

* the minimal `AIModelProvider` runtime contract
* fallback execution semantics
* provider downgrade observability schema
* architectural non-goals

---

# 2. Architectural Constraints

## Constraint A — Runtime Semantics Only

The provider interface MUST abstract only runtime execution semantics.

The contract MUST NOT:

* expose vendor-specific tuning surfaces
* unify incompatible provider features
* become a generic AI framework abstraction
* introduce capability polymorphism beyond current runtime needs

Reason:
Over-generalization creates architectural drift and weakens runtime determinism.

---

## Constraint B — Retrieval Topology Remains External

Provider fallback MUST NOT alter:

* retrieval behavior
* SQL visibility boundaries
* oracle enforcement
* semantic chunk selection

Fallback exists ONLY at inference execution layer.

The retrieval pipeline remains provider-independent.

---

## Constraint C — Observability Before Automation

Fallback behavior MUST be observable before introducing automatic retry complexity.

Initial implementation priority:

1. deterministic provider execution
2. explicit downgrade recording
3. stable request tracing
4. operational visibility

NOT:

* aggressive retry orchestration
* latency optimization
* dynamic routing heuristics

---

# 3. AIModelProvider Contract

## Design Philosophy

The provider interface represents:

* execution capability
  NOT:
* model ecosystem abstraction

The contract should remain intentionally narrow.

---

## TypeScript Contract

```ts
export interface AIModelProvider {
  readonly providerId: string;

  generateText(
    request: GenerateTextRequest
  ): Promise<GenerateTextResult>;

  streamText(
    request: StreamTextRequest
  ): Promise<TextStreamResult>;

  normalizeError(
    error: unknown
  ): ProviderRuntimeError;
}
```

---

# 4. Contract Boundary Definitions

## 4.1 providerId

Purpose:

* runtime observability
* fallback attribution
* telemetry labeling
* downgrade tracking

Examples:

```ts
"gemini"
"openrouter"
```

Non-goals:

* capability discovery
* provider metadata registry

---

## 4.2 generateText

Purpose:

* single-shot inference execution

Responsibilities:

* provider API invocation
* provider auth handling
* provider-native request mapping
* runtime error capture

Must NOT:

* perform retrieval
* mutate retrieval constraints
* alter oracle logic
* implement fallback internally

Fallback orchestration belongs to runtime coordinator layer.

---

## 4.3 streamText

Purpose:

* streaming inference execution

Responsibilities:

* provider stream initiation
* chunk forwarding
* provider stream normalization

Must NOT:

* implement retry branching
* inject runtime fallback logic

Reason:
stream lifecycle orchestration belongs outside provider adapters.

---

## 4.4 normalizeError

Purpose:

* convert provider-specific failures into deterministic runtime categories

Examples:

```ts
export type ProviderRuntimeErrorCode =
  | "rate_limit"
  | "auth_failure"
  | "timeout"
  | "provider_unavailable"
  | "invalid_request"
  | "unknown";
```

Reason:
Fallback routing logic requires normalized operational semantics.

Without normalization:

* runtime orchestration becomes vendor-coupled
* telemetry becomes inconsistent
* downgrade policies become non-deterministic

---

# 5. Runtime Fallback Topology

## Execution Flow

```text
Scene Assistant Request
  ↓
Retrieval Pipeline
  ↓
Oracle Enforcement
  ↓
Primary Provider Execution (Gemini)
  ↓
[Failure]
  ↓
Error Normalization
  ↓
Fallback Coordinator
  ↓
Secondary Provider Execution (OpenRouter)
  ↓
Response
```

Critical invariant:
Fallback occurs AFTER retrieval and oracle enforcement.

Provider fallback MUST NEVER reopen retrieval topology.

---

# 6. Fallback Observability Schema

## Design Objective

Every provider downgrade MUST produce traceable operational metadata.

The system must support:

* incident replay
* downgrade auditing
* provider reliability analysis
* request-level failure tracing

---

## Required Metadata

```ts
export interface ProviderFallbackMetadata {
  requestId: string;

  primaryProvider: string;
  fallbackProvider: string;

  downgradeReason: ProviderRuntimeErrorCode;

  downgradedAt: string;

  originalErrorMessage?: string;
}
```

---

## requestId Requirements

The `requestId` MUST:

* persist across fallback execution
* remain stable through retries
* connect all provider attempts into one trace lineage

Reason:
Fallback is NOT a new request.
It is continuation of the same runtime execution.

---

## Example Runtime Event

```json
{
  "requestId": "req_9f31a",
  "primaryProvider": "gemini",
  "fallbackProvider": "openrouter",
  "downgradeReason": "rate_limit",
  "downgradedAt": "2026-05-24T15:22:11Z"
}
```

---

# 7. Explicit Non-Goals

This ADR implementation intentionally excludes:

* weighted provider routing
* latency-aware balancing
* provider scoring systems
* dynamic model marketplaces
* capability negotiation
* automatic provider discovery
* generalized AI middleware framework

Reason:
Current system requirements only justify deterministic failover.

Premature abstraction would increase:

* operational complexity
* debugging ambiguity
* architectural drift
* runtime unpredictability

---

# 8. Recommended Runtime Layering

```text
Application Layer
  ↓
Fallback Coordinator
  ↓
AIModelProvider Interface
  ↓
Provider Adapter
  ↓
Vendor SDK
```

Important:
Fallback policy belongs to coordinator layer.

Provider adapters should remain thin runtime translators.
