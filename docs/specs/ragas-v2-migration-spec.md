# RAGAS v2 Migration Spec

# 1. Problem Statement

The current `eval/ragas/` evaluation topology does not share the same semantic authority boundary as production runtime.

RAGAS v1 currently derives evaluation hashes from:

```ts
contexts.join("\n")
```

while production runtime derives authorization truth from canonical UTF-8 raw bytes collected from:

```ts
chapterScenes[].revealedStorySlides[].caption
```

through:

```ts
collectAuthorizedSemanticBytes()
→ verifyProductionStoryOracle()
```

This creates a structural authority drift between:

* production retrieval safety
* evaluation oracle truth
* fixture hash generation

As a result:

```txt
eval pass
≠
production-safe retrieval
```

The purpose of RAGAS v2 is to eliminate this drift and bind evaluation truth directly to production oracle semantics.

---

# 2. Goals

## 2.1 Primary Goal

Establish production-authoritative raw-byte oracle alignment between:

* runtime retrieval verification
* evaluation fixture generation
* expected semantic hash validation

---

## 2.2 Secondary Goals

### A. Remove legacy evaluation normalization topology

Explicitly remove:

* `contexts.join("\n")`
* eval-only formatting
* XML-authoritative fixture structures
* string-based semantic authority

---

### B. Reuse production oracle semantics

Evaluation MUST reuse production semantic collection semantics instead of implementing an approximate parallel oracle.

---

### C. Introduce deterministic fixture regeneration

Fixture hashes must be reproducible from canonical semantic authority.

---

### D. Introduce passive fixture freshness detection

Fixture drift must become visible through regeneration diffing.

The system MUST NOT:

* auto-authorize fixture changes
* auto-overwrite committed fixture truth
* block merges through CI hard enforcement

---

# 3. Non-goals

The following are explicitly excluded from RAGAS v2 scope:

* CI merge blocking
* fail-closed governance gates
* runtime authorization redesign
* retrieval ranking redesign
* semantic similarity evaluation redesign
* automated fixture self-healing
* XML presentation layer redesign

---

# 4. Runtime Truth (Verified Repository Reality)

## 4.1 Canonical Semantic Collection

Production runtime semantic authority is defined by:

```ts
collectAuthorizedSemanticBytes(
  chapterScenes: ChapterSceneSnippet[]
)
```

Verified repository behavior:

### Scene Ordering

Scenes are sorted by:

```ts
scene.order_index ASC
```

before semantic collection.

---

### Slide Ordering

Slides preserve retrieval array order.

No additional sorting occurs.

Slide order therefore constitutes part of runtime semantic authority.

Evaluation MUST preserve identical ordering semantics.

---

### Semantic Source Boundary

Only:

```ts
slide.caption
```

participates in semantic authorization.

Presentation-layer XML wrappers MUST NOT participate in semantic authority.

---

### Encoding Boundary

Semantic bytes are collected through:

```ts
Buffer.from(slide.caption, "utf8")
```

No:

* trim
* whitespace normalization
* NFC normalization
* XML escaping
* markdown transformation

may participate in semantic collection.

---

## 4.2 Canonical Hash Boundary

Canonical semantic bytes are constructed through:

```ts
Buffer.concat(chunks)
```

with:

* no separators
* no newline insertion
* no synthetic formatting

Canonical semantic hashes are generated through:

```ts
createHash("sha256").update(buffer).digest("hex")
```

The canonical hash boundary is therefore:

* raw
* UTF-8
* byte-authoritative
* separator-free

---

# 5. Legacy Drift Audit

## 5.1 Separator Drift

Legacy RAGAS v1 behavior:

```ts
contexts.join("\n")
```

Production behavior:

```ts
Buffer.concat(chunks)
```

This creates non-equivalent semantic byte streams.

---

## 5.2 XML Authority Drift

Legacy fixtures currently store XML presentation structures as semantic contexts.

Example:

```xml
<scene>
  <story>...</story>
</scene>
```

Production semantic authority contains only raw caption strings.

XML presentation structures MUST be removed from oracle authority participation.

---

## 5.3 String-vs-Buffer Drift

Legacy RAGAS v1 hashes strings directly.

Production runtime hashes canonical raw buffers.

RAGAS v2 MUST define Buffer-based hashing as the only valid semantic authority boundary.

---

## 5.4 Ordering Drift Risk

Production runtime:

* sorts scenes
* preserves slide retrieval order

Evaluation MUST reproduce identical ordering semantics.

Evaluation-local deterministic sorting is prohibited.

---

# 6. Canonical Oracle Contract

The following jointly define production semantic authority:

## 6.1 Semantic Source

```ts
revealedStorySlides[].caption
```

---

## 6.2 Ordering Contract

```txt
scene: order_index ASC
slide: retrieval array order preserved
```

---

## 6.3 Encoding Contract

```txt
raw UTF-8 bytes only
```

---

## 6.4 Concatenation Contract

```ts
Buffer.concat(chunks)
```

without separators.

---

## 6.5 Hash Contract

```ts
sha256(canonicalRawSemanticBytes)
```

---

# 7. Runtime Invariant Binding

RAGAS v2 evaluation MUST reuse production semantic authority semantics.

The evaluation layer MUST NOT maintain an independently evolved oracle model.

Preferred topology:

```txt
eval/ragas
↓ imports
src/lib/production-story-oracle.ts
```

Specifically:

* semantic collection semantics
* canonical concatenation semantics
* hash semantics

must remain production-authoritative.

---

# 8. Fixture Topology Redesign

## 8.1 Legacy Fixture Problem

Current fixtures store:

* XML presentation structures
* synthetic formatting
* evaluation-owned semantic topology

This is incompatible with production-authoritative semantic verification.

---

## 8.2 RAGAS v2 Fixture Model

Fixtures MUST store canonical semantic caption arrays.

Example topology:

```json
{
  "question": "...",
  "captions": [
    "caption A",
    "caption B"
  ],
  "ground_truth": "...",
  "expected_context_hash": "..."
}
```

The fixture semantic source MUST correspond directly to production semantic authority inputs.

---

# 9. Deterministic Regeneration Workflow

## 9.1 Regeneration Topology

Approved topology:

```txt
canonical semantic captions
↓
regen script
↓
canonical hash generation
↓
fixture rewrite
↓
human-visible diff
↓
manual review
↓
commit
```

---

## 9.2 Governance Model

RAGAS v2 adopts:

```txt
assistive governance
```

rather than:

* punitive governance
* fail-closed governance
* automatic fixture authorization

---

## 9.3 Recommended Runnable Slice

Recommended executable entrypoint:

```bash
npm run regen:ragas-fixtures
```

Recommended implementation topology:

```txt
scripts/regen-ragas-fixtures.ts
```

The script SHOULD:

* regenerate canonical hashes
* rewrite fixture outputs deterministically
* surface visible diffs when fixture truth changes

The script MUST NOT:

* auto-commit
* auto-authorize
* silently overwrite governance drift

---

# 10. Fixture Freshness Detection

RAGAS v2 freshness detection is passive.

Freshness validation occurs through:

* deterministic regeneration
* git diff visibility
* manual review

The system SHOULD surface:

* stale fixture hashes
* semantic authority drift
* runtime/eval mismatch

The system MUST NOT:

* automatically update committed truth
* mutate fixture authority during runtime
* enforce merge blocking

---

# 11. Migration Plan

## Step 1 — Remove Legacy Join Oracle

Remove:

* `contexts.join("\n")`
* string-authoritative hash generation

from:

* `normalize-context.ts`
* `content-hash-oracle.ts`

---

## Step 2 — Introduce Canonical Caption Fixtures

Replace XML-authoritative contexts with:

* canonical caption arrays
* production-authoritative semantic inputs

---

## Step 3 — Bind Evaluation to Production Semantics

Evaluation MUST reuse:

* production semantic collection semantics
* canonical hash semantics

through shared runtime logic.

---

## Step 4 — Recompute Canonical Fixture Hashes

Recompute all:

* 13 canonical evaluation pairs
* expected semantic hashes

using production-authoritative raw-byte semantics.

---

## Step 5 — Introduce Passive Freshness Workflow

Add deterministic regeneration workflow:

* visible fixture diff
* manual governance review
* no CI hard blocking

---

# 12. Architectural Outcome

RAGAS v1:

```txt
evaluation simulates production truth
```

RAGAS v2:

```txt
evaluation reuses production authority
```

This migration converts evaluation from:

* approximation-based validation
  to:
* runtime-authoritative semantic verification

The resulting topology establishes:

* raw-byte semantic authority
* production-eval convergence
* deterministic semantic verification
* runtime-bound evaluation invariants
