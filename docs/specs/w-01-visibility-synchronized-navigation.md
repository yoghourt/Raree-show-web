# W-01: Visibility-Synchronized Navigation (Client State Machine)

This document specifies **reader client** runtime orchestration for scene and story-slide navigation. It implements the end-to-end requirement that the Scene Assistant observe **committed visibility boundary state** (see [ADR-002: Hybrid RAG with Two-Layer Visibility Boundary](../adr/002-hybrid-rag-retrieval.md)).

ADR-002 defines **topology**, **visibility boundaries**, and **invariants** for retrieval and prompt assembly. W-01 defines **how** the client commits progress and **refreshes assistant retrieval context** so each assistant request carries `userProgress` consistent with ADR-002 Layer 1 and Layer 2.

---

## Goals

- Cross-scene and cross-slide navigation updates `readUpToChapter`, `readUpToOrderIndex`, `sceneTsid`, and `readUpToStoryIndexLast` in lockstep with the presented scene and reel index.
- No **retrieval** step for the next question runs against stale committed boundary state after a navigation the user considers committed.
- Edge behavior at the first/last scene and slide does not mutate progress, does not change scene, and does not force an unnecessary **retrieval context refresh** (optional UX feedback such as vibration remains allowed).

---

## Visibility-Synchronized Navigation State Machine

Scene transitions are **not** committed until visibility-related state is synchronized with the Retrieval and Prompt boundaries defined in ADR-002.

### Mandatory transition order

1. **CommitProgress** — Atomically update committed progress fields (`readUpToChapter`, `readUpToOrderIndex`, `sceneTsid`, `readUpToStoryIndexLast`) for the target reading state. No updated scene presentation may run before this commit completes in the client state model.
2. **PresentScene** — Update the presented reading UI (scene chrome, story reel, captions) to match the committed scene and slide index; align what the user sees with the Prompt Visibility Boundary fields the next request will send.
3. **Assistant retrieval context refresh** — After the committed boundary changes, the client must not reuse **retrieval-relevant** state from the previous boundary when assembling the next Scene Assistant request (e.g. cached scope, stale `userProgress`, or client-held retrieval artifacts keyed on the old scene). The next retrieval lifecycle must observe **only** the newly committed progress and `sceneTsid`.

**Normative scope of step 3:** correctness of **retrieval inputs and boundary observability**. **Chat transcript continuity, panel open/closed state, and other pure UX session choices** are product decisions; they neither replace retrieval context refresh nor satisfy it unless retrieval would still be correct without refresh.

### Forbidden sequence

```text
scene presentation → assistant retrieval → progress mutation
```

### Required sequence

```text
progress mutation → scene presentation → assistant retrieval
```

---

## Edge overflow

- At the **first** scene and **first** slide, “previous story slide” does not mutate progress and does not change scene.
- At the **last** scene and **last** slide, “next story slide” does not mutate progress and does not change scene.
- Product may provide tactile or visual feedback on overflow (e.g. `navigator.vibrate`); behavior is optional; boundary preservation is mandatory.

---

## Reference implementation (non-normative)

The following describes the **current codebase** for discoverability only. Conformant clients may differ as long as **CommitProgress**, **PresentScene**, and **assistant retrieval context refresh** semantics are preserved.

- `src/components/raree/useSceneAtomicNavigation.ts` — reducer holding `visualScene` and `imageIndex` so cross-scene updates are a single state transition.
- `src/components/raree/SceneExperience.tsx` — ropes / reel boundary handling, URL `replaceState`.

**Example (non-normative):** remounting the assistant subtree when `sceneTsid` changes (e.g. React `key={visualScene.tsid}`) is one way to avoid stale client state affecting the next request; clearing chat history is a **UX** consequence of that pattern, not a separate architectural requirement. Other patterns (explicit cache invalidation, request-scoped stores) are valid if retrieval context refresh is guaranteed.

**`readUpToStoryIndexLast` (client, normative):** Must remain `effectiveSlideCount === 0 ? -1 : imageIndex` with the same effective story list as the server (non-empty `url` in `story_images_v2` order). Do not relax this formula in the scene component.

**Framework note (non-normative):** In React, deriving `userProgress` from the same render as the committed `visualScene` / `imageIndex` after `CommitProgress` + `PresentScene` (e.g. one reducer dispatch for scene + slide) satisfies coherency for the next request props.

---

## Validation (client)

- After navigating to the next/previous scene via story reel boundaries, the next POST to `/api/scene-assistant` includes `userProgress` (including `sceneTsid` and `readUpToStoryIndexLast`) matching the on-screen scene and slide.
- Overflow at the ends of the work does not change `userProgress` and does not incorrectly refresh retrieval context as if a boundary transition occurred.
- **Retrieval context:** No assistant request after a committed boundary change uses client-held retrieval inputs that still assume the previous `sceneTsid` or prior progress snapshot.
