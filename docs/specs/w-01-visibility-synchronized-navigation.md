# W-01 — Browser Runtime Specification: Visibility-Synchronized Navigation

## Metadata

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Title        | Browser Runtime Specification — Visibility-Synchronized Navigation    |
| Status       | **Accepted**                                                          |
| Version      | v2.1                                                                  |
| Owner        | Architect                                                             |
| Last Updated | 2026-07-11                                                            |
| Repository   | raree-show-web                                                        |
| Related      | ADR-002, SPEC-RDX-001, Runtime Reading Governance RC1 (raree-show-admin) |

> **Vocabulary Notice:** This document uses **implementation symbols** only (`Scene`, `sceneTsid`,
> `story_images_v2`, `readUpToStoryIndexLast`). Normative Runtime vocabulary lives in
> `governance/vocabulary/runtime-lexicon.md` (`raree-show-admin`). Runtime Reading semantics live in
> **SPEC-RDX-001** — not in W-01.

**Division of authority:**

```text
SPEC-RDX-001  →  defines Runtime Reading semantics
W-01          →  defines browser client orchestration only
```

W-01 is a **Browser Runtime Specification**. It MUST NOT define Runtime Reading capability, lifecycle, invariants, or ownership. For all Runtime Reading semantics, see **SPEC-RDX-001** (`raree-show-admin`).

---

## 1. Governance Prerequisite

```text
raree-show-admin:  Constitution → ADR → SPEC-RDX-001 → Runtime Reading Governance RC1
raree-show-web:    W-01 → runtime-architecture.md → Implementation
```

W-01 MUST NOT redefine anything governed by SPEC-RDX-001. See SPEC-RDX-001 §1.2 (one-way authority).

---

## 2. W-01 Scope — Browser Concerns Only

W-01 owns **client-side orchestration** in the browser:

| In scope | Out of scope (see SPEC-RDX-001 or runtime-architecture.md) |
| -------- | ----------------------------------------------------------- |
| URL / History (`replaceState`) | Runtime Reading lifecycle definition |
| Client reducer state (`visualReadingRoute`, `imageIndex`) | Capability ownership |
| **Commit ordering** (CommitProgress → Present → refresh) | Editorial / projection semantics |
| **Visibility synchronization** with ADR-002 boundaries | Rendering policy, animation, layout |
| **Retrieval context refresh** after commit | Server retrieval, oracle, generation |
| Edge overflow at route/frame bounds | Database, API design |

Navigation is **browser orchestration** — not a Runtime Reading capability. Navigation **implements** commit ordering and visibility rules defined here; Runtime meaning is defined upstream.

---

## 3. Goals

- Committed client fields (`readUpToChapter`, `readUpToOrderIndex`, `sceneTsid`, `readUpToStoryIndexLast`) stay in lockstep with the presented route and frame index after navigation.
- No Assistant **retrieval** runs against stale committed boundary state after a user-committed navigation ([ADR-002](../adr/002-hybrid-rag-retrieval.md)).
- Edge overflow at the first/last route and frame does not mutate committed fields or force a spurious retrieval refresh (optional UX feedback such as vibration remains allowed).

**Conformance:** Client orchestration MUST remain consistent with SPEC-RDX-001. W-01 does not restate RDX lifecycle or phase definitions — see SPEC-RDX-001 §2.

---

## 4. Visibility-Synchronized Navigation State Machine

Route transitions are **not** committed until visibility-related state is synchronized with ADR-002 Retrieval and Prompt boundaries.

### 4.1 Mandatory transition order

1. **CommitProgress** — Atomically update committed client fields for the target route + frame index. No updated presentation may run before this commit completes in the client state model.
2. **PresentScene** — Update presented UI (route chrome, frame reel, captions) to match committed route and frame index; align visible state with Prompt Visibility Boundary fields the next request will send.
3. **Retrieval context refresh** — After committed boundary changes, the client MUST NOT reuse retrieval-relevant state from the previous boundary when assembling the next Assistant request.

**Normative scope of step 3:** retrieval inputs and boundary observability only. Chat transcript continuity, panel open/closed state, and other UX session choices are product decisions.

### 4.2 Forbidden sequence

```text
presentation → assistant retrieval → progress mutation
```

### 4.3 Required sequence

```text
progress mutation → presentation → assistant retrieval
```

---

## 5. Edge Overflow

- At the **first** route and **first** frame, “previous frame” does not mutate committed fields and does not change route.
- At the **last** route and **last** frame, “next frame” does not mutate committed fields and does not change route.
- Optional tactile or visual feedback on overflow is permitted; boundary preservation is mandatory.

---

## 6. Out of Scope

| Topic | Owner |
| ----- | ----- |
| Rendering, animation, visual composition, media layout | Implementation / Presentation |
| Runtime Reading semantics | SPEC-RDX-001 |
| Editorial / projection vocabulary and rules | ADR-005, SPEC-ROL-* (admin) |
| Server retrieval, oracle, LLM | runtime-architecture.md |

---

## 7. Reference Implementation (Non-Normative)

- `src/components/raree/useReadingRouteNavigation.ts` — reducer: `visualReadingRoute`, `imageIndex`; single dispatch for cross-route updates.
- `src/components/raree/ReadingRouteExperience.tsx` — reel boundary handling, URL `replaceState`.

**Example (non-normative):** remounting the assistant subtree when `sceneTsid` changes (e.g. React `key={visualScene.tsid}`) is one valid retrieval refresh pattern.

**`readUpToStoryIndexLast` (client, normative):** `effectiveSlideCount === 0 ? -1 : imageIndex`, using the same effective frame list as the server (non-empty `url` in `story_images_v2` order).

**Framework note (non-normative):** Deriving `userProgress` from the same render as committed `visualScene` / `imageIndex` after CommitProgress + PresentScene satisfies coherency for the next request props.

---

## 8. Validation (Client)

- After cross-route navigation via reel boundaries, the next POST to `/api/scene-assistant` sends `userProgress` (`sceneTsid`, `readUpToStoryIndexLast`, etc.) matching the on-screen route and frame.
- End-of-work overflow does not change `userProgress` or trigger a spurious retrieval refresh.
- No Assistant request after a committed boundary change uses client-held retrieval inputs from the previous boundary.

---

## 9. Refs

```text
raree-show-admin/docs/specs/spec-rdx-001-runtime-reading-experience.md   Runtime Reading authority
raree-show-admin/docs/specs/runtime-reading-governance-rc1.md          Governance RC1 baseline
docs/adr/002-hybrid-rag-retrieval.md                                   Visibility boundary
docs/runtime-architecture.md                                           Server + repo implementation
governance/vocabulary/runtime-lexicon.md                               Runtime vocabulary (admin)
```
