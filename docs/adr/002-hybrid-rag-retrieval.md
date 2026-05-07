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