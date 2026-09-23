# Raree Show Web — Runtime Implementation Architecture

## Metadata

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Status       | **Accepted**                                                          |
| Version      | v2.2                                                                  |
| Last Updated | 2026-09-23                                                            |
| Authority    | How this repository realizes Runtime Reading — not what it is         |
| Baseline     | Runtime Reading Governance RC1 (`raree-show-admin`)                   |

> **Vocabulary Notice:** Implementation symbols (`Scene`, `story_images_v2`, `caption`) appear throughout
> `src/`. Normative Runtime vocabulary: `governance/vocabulary/runtime-lexicon.md` (`raree-show-admin`).

This document answers:

> **How does raree-show-web implement the reader runtime?**

It does **not** answer what Runtime Reading Experience is. That authority is **SPEC-RDX-001** (`raree-show-admin`). Browser client orchestration is **W-01**.

---

## 1. Repository Authority Boundary

```text
┌─────────────────────────────────────────────────────────────────┐
│  raree-show-admin                                               │
│  Architecture Authority                                         │
├─────────────────────────────────────────────────────────────────┤
│  Constitution                                                   │
│       ↓                                                         │
│  ADR (004, 005, 007, 009, …)                                    │
│       ↓                                                         │
│  SPEC (ROL-001, ROL-002, RDX-001, …)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │  one-way reference (no reverse edits)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  raree-show-web                                                 │
│  Realization & Implementation                                   │
├─────────────────────────────────────────────────────────────────┤
│  W-01                    Browser client orchestration           │
│       ↓                                                         │
│  runtime-architecture.md  This document — server + repo layout  │
│       ↓                                                         │
│  Implementation (src/)   React, API routes, services            │
└─────────────────────────────────────────────────────────────────┘
```

**Rule:** Admin defines architecture and capability. Web realizes and implements. Web docs MUST NOT become a second source of Runtime Reading semantics.

---

## 2. In-Repository Dependency

```text
SPEC-RDX-001  (admin — capability; cite only)
     ↓
Runtime Reading Governance RC1  (admin — release baseline)
     ↓
W-01          (browser orchestration)
     ↓
runtime-architecture.md  (this document)
     ↓
src/
```

Implementation MUST NOT amend SPEC-RDX-001 from this repository. Semantic changes require admin SPEC revision.

---

## 3. Implementation Layers (This Repository)

```text
┌─────────────────────────────────────────┐
│  Presentation                           │  React UI, layout, animation
│  Owner: Implementation (src/components) │
└────────────────────┬────────────────────┘
                     │
┌──────────────────────────────────────────┐
│  Runtime Services                        │  API, retrieval, oracle,
│  Owner: Implementation                   │  generation (`src/runtime`)
│  (src/services, src/app/api, src/runtime)│
└────────────────────┬─────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│  Browser Orchestration                  │  Commit order, reducer, URL
│  Owner: W-01 (src/components/raree/*)   │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│  Persistence                            │  Supabase client, pgvector
│  Owner: Implementation                  │
└─────────────────────────────────────────┘
```

Runtime Reading **capability** sits in admin SPEC-RDX-001 — not in this stack. This stack shows **how web code is organized** to realize it.

---

## 4. Representation Consumed by This Repository

Persistence topology and capability semantics: **SPEC-RDX-001** and **ADR-004** (`raree-show-admin`).

This repository **reads** Runtime Representation (`scenes`, `story_images_v2`, etc.) and **implements** against it. Do not restate topology or capability definitions here.

**Implementation constraint:** Do not introduce module names that imply Editorial authority (e.g. `StoryNavigator`, `SceneManager` as editorial owners). See SPEC-RDX-001 §3 and ADR-005.

---

## 5. Realization Map (Implementation Only)

What this repository **does** — mapped to admin authority by reference, not redefinition:

| This repository | Realization | Authority for semantics |
| --------------- | ----------- | ----------------------- |
| Route URL load, session init | Browser entry | SPEC-RDX-001 §2 (cite) |
| `ReadingRouteExperience` frame reel | Browser presentation + W-01 commit order | W-01 |
| `CommitProgress` / reducer dispatch | Client field commit | W-01 |
| `userProgress` payload | Client committed snapshot | W-01 + ADR-002 |
| `/api/scene-assistant` | Server request handler | Implementation |
| `retrieval.ts` hybrid RAG | SQL gate → vector rerank | ADR-002 + Implementation |
| `production-story-oracle.ts` | SHA-256 before LLM | Implementation |
| `executeVerifiedGeneration` | Gemini stream; OpenRouter only before the first text token, and only if `OPENROUTER_API_KEY` is set | ADR-003 |
| `req.signal` on `/api/scene-assistant` | Abort reaches provider generation and does not start fallback | ADR-013 |

For lifecycle phase names and capability ownership, see **SPEC-RDX-001** §2 and §3 — not this table.

---

## 6. Module Ownership

| Module / path | Owner |
| ------------- | ----- |
| `src/components/raree/useReadingRouteNavigation.ts` | **W-01** |
| `src/components/raree/ReadingRouteExperience.tsx` | **W-01** |
| `src/components/raree/ReadingRouteAssistant.tsx` | **Implementation** |
| `src/services/retrieval.ts` | **Implementation** |
| `src/lib/production-story-oracle.ts` | **Implementation** |
| `src/lib/visibility-invariant.ts` | **Implementation** |
| `src/app/api/scene-assistant/route.ts` | **Implementation** |
| `src/runtime/` | **Implementation** (ADR-003, ADR-013) |
| `src/lib/assistant-generation-lifecycle.ts` | **Implementation** (client Stop / terminal state) |
| Runtime Reading semantics (any) | **SPEC-RDX-001** (admin) |

---

## 7. Scene Assistant Pipeline (Deployed)

The Scene Assistant answers questions about the reader's current position with **system-enforced spoiler boundaries** (ADR-002).

```text
Client progress
  → retrieveVerifiedAssistantContext
       semantic retrieval (SQL gate → embed → vector rerank)  ┐ parallel I/O
       revealed captions for the current chapter              ┘
  → SHA-256 on revealed caption bytes
  → prompt assembly
  → executeVerifiedGeneration
       Gemini (gemini-3.5-flash-lite)
       OpenRouter only if OPENROUTER_API_KEY is set and Gemini fails before the first text token
       AbortSignal does not enter fallback
```

| Stage | Owner | Role |
| ----- | ----- | ---- |
| Client commit + refresh | **W-01** | Committed `userProgress` before retrieval |
| SQL visibility gate | **Implementation** | Route candidate filter |
| Vector rerank | **Implementation** | Semantic rank within SQL set. Default `match_count` is 10 |
| SHA-256 verification | **Implementation** | Fail-closed on revealed caption bytes, before the prompt is sent |
| Prompt assembly | **Implementation** | System prompt uses only those revealed captions |
| Generation | **Implementation** | `src/runtime/`: Gemini primary; optional OpenRouter pre-token fallback |
| Cancellation | **Implementation** | `req.signal` forwarded into provider `streamText`; abort is not fallback |

Client commit ordering: [W-01](specs/w-01-visibility-synchronized-navigation.md).

---

## 8. Serial Hybrid RAG (ADR-002)

```text
metadataPreFiltering (SQL) → match_scenes (vector rerank)
```

- **SQL gate:** `workTsid`, `readUpToChapter`, `readUpToOrderIndex`
- **Vector rerank:** pgvector on SQL-approved tsids only

Implementation: [`src/services/retrieval.ts`](../src/services/retrieval.ts).

---

## 9. Two-Layer Visibility Boundary

### Layer 1 — Retrieval (SQL)

Which routes enter hybrid search.

### Layer 2 — Prompt (in-memory)

Which frame captions are model-visible for the current route (`sceneTsid`, `readUpToStoryIndexLast`).

Layer 2 runs after retrieval. W-01 governs client sequencing so `userProgress` matches committed UI state.

---

## 10. SHA-256 Production Oracle

[`src/lib/production-story-oracle.ts`](../src/lib/production-story-oracle.ts): `sha256` over raw caption UTF-8 from revealed slides; ascending route order, array frame order. Mismatch → `InvariantViolationError` (HTTP 500), no LLM call.

Eval v2 uses the same raw-caption hash via `hashRawCaptions` ([`eval/ragas/README.md`](../eval/ragas/README.md)). `legacyRagasJoinHashForTelemetry` (captions joined with newlines) is telemetry only and does not gate generation.

---

## 11. Generation Runtime (Deployed)

```text
retrieveVerifiedAssistantContext
  → executeVerifiedGeneration (src/runtime/fallback-coordinator.ts)
  → Gemini, or OpenRouter if OPENROUTER_API_KEY is set and failure is before the first text token
  → ReadingRouteAssistant
```

[ADR-003](adr/003-multi-provider-ai-runtime.md) is implemented on `POST /api/scene-assistant`. Query embeddings stay on `gemini-embedding-001` (768 dimensions) in `src/services/retrieval.ts` and have no fallback.

[ADR-013](adr/013-scene-assistant-cancellation-semantics.md): the Stop control aborts the browser `fetch`. The route passes `req.signal` into generation. Abort does not start another provider. Text already streamed is kept and marked Stopped; a stop before any text drops the empty assistant message. Production/Vercel cancellation has not been separately probed.

---

## 12. Governance CI

| Mechanism | Purpose |
| --------- | ------- |
| `npm run bootstrap` | `governance/` submodule sync |
| `npm run check:governance` | Entrypoint verification |
| PR workflow | Bootstrap + check on PRs |

CI verifies governance mount — not in-request governance engine.

---

## 13. Offline Evaluation

RAGAS harness: [`eval/ragas/README.md`](../eval/ragas/README.md) and [`docs/specs/ragas-evaluation-suite.md`](specs/ragas-evaluation-suite.md). Local only (`npm run eval:ragas`). Not a CI gate. Candidate run record: [`docs/evaluations/ragas-baseline-v1.md`](evaluations/ragas-baseline-v1.md).

---

## 14. Deployed vs Planned

| Item | Status | Owner |
| ---- | ------ | ----- |
| W-01 visibility-synchronized navigation | **Deployed** | W-01 |
| Hybrid RAG (SQL → vector) | **Deployed** | Implementation |
| Visibility gates + SHA-256 oracle | **Deployed** | Implementation |
| Gemini generation (`gemini-3.5-flash-lite`) | **Deployed** | Implementation |
| OpenRouter pre-token fallback (key-gated) | **Deployed** | ADR-003 |
| Cooperative cancellation in the request path | **Deployed in code** | ADR-013 |
| Production / Vercel abort behavior | **Not verified** | ADR-013 |
| Embedding failover | **Not implemented** | `src/services/retrieval.ts` |
| Frame UI rendering | **Deployed** | Implementation |

---

## 15. Refs

### Admin (authority — cite, do not duplicate)

- [SPEC-RDX-001 — Runtime Reading Experience](https://github.com/yoghourt/raree-show-admin/blob/main/docs/specs/spec-rdx-001-runtime-reading-experience.md)
- [Runtime Reading Governance RC1](https://github.com/yoghourt/raree-show-admin/blob/main/docs/specs/runtime-reading-governance-rc1.md)
- [SPEC-ROL-001](https://github.com/yoghourt/raree-show-admin/blob/main/docs/specs/spec-rol-001-governed-projection.md) · [SPEC-ROL-002](https://github.com/yoghourt/raree-show-admin/blob/main/docs/specs/spec-rol-002-projection-semantics.md)

### Web

- [W-01 — Browser Runtime Specification](specs/w-01-visibility-synchronized-navigation.md)
- [ADR-002: Hybrid RAG](adr/002-hybrid-rag-retrieval.md)
- [ADR-003: Multi-Provider AI](adr/003-multi-provider-ai-runtime.md) — deployed generation failover
- [ADR-013: Cancellation](adr/013-scene-assistant-cancellation-semantics.md)
- [RDX Governance Compatibility Report](specs/rdx-governance-compatibility-report.md) — frozen historical record
