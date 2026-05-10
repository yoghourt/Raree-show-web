## Context

The current Scene Assistant uses a static retrieval scope, which results in:
- inability to answer cross-scene questions.
- lack of an enforced data access boundary.

Specifically:
1. It cannot answer questions like "Where did Bran appear before?"
2. It may return content beyond the user's reading progress.

Prior state:
- Phase 1 completed the initial infrastructure:
  - Embedding backfill feature has been implemented in CMS.
  - Debug endpoint for scene retrieval has been completed but has not been integrated into the Scene Assistant runtime.

Need:
- The Scene Assistant supports query-aware retrieval scope.
- The system enforces a data access boundary.

## Decision

Hybrid RAG is a two stage serial pipeline. It consists of two retrieval steps: a SQL retrieval followed by a vector retrieval. SQL acts as a mandatory safety gate and produces a filtered subset of scenes. Vector performs downstream semantic relevance reranking over SQL output. Vector operates on SQL output.

## Alternatives

- Routing
  - Definition: The system selects between SQL and vector based on query type or other condition.
  - Rejection: This approach does not satisfy the requirement that SQL must be mandatory, because it makes SQL not a mandatory step, which violates "SQL must be a mandatory safety gate (cannot be bypassed)."
  
- Fallback
  - Definition: The system runs SQL retrieval first, if SQL results are insufficient, vector is executed.
  - Rejection: This approach does not satisfy the requirement that vector must be mandatory, because it makes vector not a mandatory step, which violates "Vector semantic reranking must always be executed."
  
- Pure vector
  - Definition: The system only runs vector retrieval.
  - Rejection: This approach does not satisfy the requirement that SQL must be mandatory, because it makes SQL not a mandatory step, which violates "SQL must be a mandatory safety gate (cannot be bypassed)."
  
## Consequences

### Benefits
- SQL increases safety by enforcing a data access boundary.
- Vector introduces semantic relevance by reranking.
- Serial pipeline increases predictability and consistency.

### Trade-offs
-  The two-stage retrieval increases the total response latency.
-  The two-stage retrieval increases complexity for debugging SQL filtering vs vector reranking.

---

## Reading boundary (scene + story) — prompt assembly (2026)

This section documents **finer-grained spoiler control** for the Scene Assistant. It **does not** change the retrieval topology above: the **only** semantic retrieval path remains **`metadataPreFiltering` → `match_scenes`**.

### Two-stage boundary

1. **SQL gate (unchanged)**  
   `metadataPreFiltering` still builds the candidate scene set using `chapter_number` and `order_index` (lexicographic “read up to” semantics). This is the mandatory ADR-002 safety gate for vector search.

2. **Physical truncation at prompt assembly**  
   For narrative text derived from `story_images_v2`, the server **must** slice captions **before** any LLM call:
   - Scenes **strictly before** the reader’s current `order_index` within the work: **all** effective story slides (see below) are eligible.
   - The **current** scene (identified by business id `scenes.tsid` = `sceneTsid`): only slides with indices `0..readUpToStoryIndexLast` (inclusive) are eligible.

**Hard rule:** never send the full `story_images_v2` caption list for the current scene and ask the model to “ignore” unread slides. Unread captions must not appear in model-visible tokens.

### Progress fields (API / `ProgressConfig`)

- Existing: `workTsid`, `readUpToChapter`, `readUpToOrderIndex` (scene-level gate; unchanged for SQL).
- Added: `sceneTsid` (current scene `tsid`), `readUpToStoryIndexLast` (0-based index into the **effective** story list; see below).

**Effective story list** (must match the client ImageReel): entries from `story_images_v2` with non-empty trimmed `url`, in array order; `caption` is a string (empty allowed).

**Product default (locked):** `readUpToStoryIndexLast` aligns with the client carousel index for the **currently visible** slide (`imageIndex`), inclusive — i.e. the visible caption counts as revealed. If there are no slides, send `-1` and the server reveals **no** story captions for the current scene.

Server **clamps** `readUpToStoryIndexLast` to `[ -1, effectiveSlideCount - 1 ]` per scene to avoid drift or malicious bodies.

### Same-chapter revealed-scene context (terminology)

Prompt-only reads from the `scenes` table that load `story_images_v2` (after truncation) and related fields to build the system prompt are called **same-chapter revealed-scene context**. This is **not** semantic retrieval, **not** a second pipeline branch, and **not** “chapter retrieval” or “cross-scene retrieval” in the ADR-002 sense.

### Model-visible context

- **`match_scenes` similarity / score / distance** metadata is intentionally **excluded** from the model-facing system prompt (observability may still log on the server).

### Follow-up (optional)

- Story-level embedding chunks (ADR-001 granularity evolution) if RAG text should align exactly with story boundaries without relying on post-filtering.
