# Runtime Reading Sprint #1 — Architecture Acceptance Report

## Metadata

| Field | Value |
| ----- | ----- |
| Sprint | Runtime Reading Implementation Sprint #1 |
| Type | Architecture realization (Product Freeze) |
| Repository | raree-show-web |
| Baseline | Runtime Reading Governance RC1 |
| Date | 2026-07-12 |
| Status | **Ready for Architect Gate (ACA-001)** |

---

## 1. Completed Work

### G1 — Governance references (comments only)

| File | Change |
| ---- | ------ |
| `src/components/raree/useReadingRouteNavigation.ts` | RC1 / SPEC-RDX-001 / W-01 authority; RDX lifecycle comment map; `imageIndex` = Reader Step index note |
| `src/components/raree/ReadingRouteExperience.tsx` | RC1 authority chain; RDX-1~5 lifecycle comments; projection boundary note |
| `src/lib/reading-frames.ts` | Representation vs capability ownership comment |
| `src/app/works/[workId]/scenes/[sceneId]/page.tsx` | Projection Complete precondition; Runtime-only consumption |
| `src/lib/data.ts` | Scenes fetch: Runtime Representation only; no projection tables |

### G2 — Pure extract (behavior-neutral)

| File | Change |
| ---- | ------ |
| `src/lib/reader-step.ts` | **New** — `ReaderStepIndex` alias + `readUpToStoryIndexLastFromStep` (exact copy of prior inline formula) |
| `ReadingRouteExperience.tsx` | Uses helper for `readUpToStoryIndexLast`; formula unchanged: `count === 0 ? -1 : imageIndex` |

### G3 — Projection boundary audit

| Check | Result |
| ----- | ------ |
| Web reads `scenes` + `story_images_v2` only | Confirmed (`src/lib/data.ts`, page.tsx) |
| No `story_units` / SceneProjectionLink / Rollout writes | Confirmed — zero matches in `src/` |
| SceneProjectionLink consumption | Deferred (RC1) — not implemented |
| Graceful absence (RDX-RS-06) | Satisfied by existing frame-only path |

### Explicitly not changed (Product Freeze)

- CaptionDisplay / `resolveCaption` (raw `story_images_v2[index]`)
- Reducer clamp / SET_SLIDE / animation-before-commit timing
- Navigation, URL, Assistant, retrieval logic
- Admin governance documents

---

## 2. Governance Alignment

| Check | Result |
| ----- | ------ |
| RC1 dependency chain reflected in code comments | ✔ |
| No capability drift | ✔ |
| No ownership duplication | ✔ |
| SPEC-RDX-001 cited; not redefined | ✔ |
| W-01 remains browser orchestration owner | ✔ |
| Rendering / caption policy not absorbed into RDX | ✔ |

### Conformance Matrix (RC1)

| RC1 Contract | Implementation |
| ------------ | -------------- |
| Reader Step (governance mapping) | ✔ Comment + type alias; `imageIndex` implements step index |
| Lifecycle | ✔ Comment map only (RDX-1~5) |
| Projection boundary | ✔ Audit + comments; no projection reads |
| Navigation ordering | ✔ Unchanged behavior |
| Runtime ownership | ✔ W-01 vs Implementation clarified in comments |

---

## 3. Behavior Regression Checklist (Architect Gate)

> Product Freeze: same user, same work, same path — **no behavioral difference**.

| # | Check | Result | Method |
| - | ----- | ------ | ------ |
| 1 | Reading flow unchanged | ✔ | No change to Work → Route → Frame sequence; no new navigation abstraction |
| 2 | Navigation unchanged | ✔ | Reducer semantics identical; overflow handlers untouched; ImageReel animation path unchanged |
| 3 | Reader progress unchanged | ✔ | `readUpToStoryIndexLastFromStep` ≡ prior `count === 0 ? -1 : imageIndex`; other progress fields untouched |
| 4 | Assistant behavior unchanged | ✔ | No changes to ReadingRouteAssistant, retrieval, or oracle |
| 5 | Retrieval boundary unchanged | ✔ | No changes to `retrieval.ts`, `visibility-invariant.ts`, `reading-frames.ts` logic |
| 6 | URL behavior unchanged | ✔ | `replaceState` / `popstate` paths untouched |
| 7 | Caption presentation unchanged | ✔ | CaptionDisplay not modified (known index divergence deferred) |

**Section B verdict:** All ✔ — Product Freeze satisfied. Eligible for Sprint #1 merge pending ACA-001.

---

## 4. Architecture Audit Notes (Informational)

| Note | Classification | Sprint #1 action |
| ---- | -------------- | ---------------- |
| CaptionDisplay indexes raw `story_images_v2[imageIndex]` while ImageReel uses effective (filtered) frames | Known product state | **Document only** — fix deferred to future capability SPEC |
| Intra-route `STEP_*` dispatches after ImageReel exit animation | Presentation precedes Progress Update for frame steps | **Document only** — UX unchanged |
| SceneProjectionLink not consumed | RC1 deferred | **No implementation** |
| `SET_SLIDE` action unused | Dead code | **Left as-is** (Product Freeze) |

No redesign proposals. No Architecture Issues blocking Sprint #1.

---

## 5. Affected Modules

```text
src/lib/reader-step.ts                         (new — pure extract)
src/lib/reading-frames.ts                      (comments)
src/lib/data.ts                                (comments)
src/components/raree/useReadingRouteNavigation.ts  (comments)
src/components/raree/ReadingRouteExperience.tsx    (comments + extract call)
src/app/works/[workId]/scenes/[sceneId]/page.tsx (comments)
docs/implementation/runtime-reading-sprint-1-acceptance-report.md  (this file)
```

---

## 6. Architecture References

```text
raree-show-admin/docs/specs/spec-rdx-001-runtime-reading-experience.md
raree-show-admin/docs/specs/runtime-reading-governance-rc1.md
raree-show-admin/docs/specs/spec-rol-001-governed-projection.md
raree-show-admin/docs/specs/spec-rol-002-projection-semantics.md
docs/specs/w-01-visibility-synchronized-navigation.md
docs/runtime-architecture.md
```

---

## 7. Verdict

| Gate | Status |
| ---- | ------ |
| Governance alignment | **PASS** |
| Product Freeze verification | **PASS** |
| No runtime regression (checklist) | **PASS** |
| ACA-001 eligibility | **Ready for Architect Conformance Audit** |

Sprint #1 does **not** merge until ACA-001 passes.
