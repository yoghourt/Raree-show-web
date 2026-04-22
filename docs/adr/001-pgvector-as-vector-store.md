# ADR-001: pgvector as vector store

## Context

When the Scene Assistant in Raree Show need to find some scenes which are most similar with the user question semantically, the project need a vector store to storage embedding data.

key constraints:

- latency: the search time that queries top K scenes(User inputs the question, expects the scene assistant return the result as soon as possible) should less than 500ms.
- cost: zero or minimal additional costs(solo project, no budget)
- operational: must not introduce new services that require separate monitoring, backup or scaling.
- data scale: hundreds of scenes initially, not expected to exceed low thousands.
- integration: must query scenes/characters/locations at the same time in a single request.

prior state （at decision time）:

- Supabase Postgres is already using in project, so unvectorized data should storage in it.
- hybird RAG path been confirmed -- vector store need to be a fallback layer, not the most important.
- model selected: gemini-embedding-001
- no vectorized data
- solo project

Need：

- a vector store capable of semantic search over scene data.
- must intergrate seamlessly with Supabase.
- must be friendly to a single developer.

## Decision

Use pgvector (Supabase-native Postgres extension) as the vector store for
Raree Show's RAG hybrid path. Vectors will live in the same database as
scenes/characters/locations, queried via a single Postgres connection with
SQL + vector operations combined in one request.

## Alternatives considered

- none dedicated vector store(store embeddings as float[] in Postgres, JS compute cosine similarity)
    - Rejected reason: JS compute the cosine similarity in the run-time is slower than DB, can not search Top-K + SQL filter in a single request, which breaks the hybrid RAG architecture.
  
- pgvector （selected）
  
- Pinecone
    - need to add new service (violates the operational-surface)
    - cost not match: free version has serverless cold start problem, paid version cost $50+ (violates the cost constraint)
    - cross services request: round-trip requests between Supabase and Pinecone, increase delay
    - data scale: Pinecone optimize millions of vectors, but Raree show only has hundreds -- Its optimization scale doesn't match our scale.
- Chroma
    - need to add new service (violates the operational-surface)
    - cost not match: charge based on usage(violates the cost constraint)
    - cross services request: round-trip requests between Supabase and Chroma, increase delay 

## Consequences

- Short-term:
    - enable pgvector extension on Supabase.
    - scenes table gains two columns: rag_embedding(storge vector array) and rag_text (RAG embedding text)
    - Existing scene data requires a one-time backfill; subsequent inserts or edits trigger re-embedding.
- Long-term:
    - data scale ceiling: pgvector with ivfflat handles up to ~1MB vectors comfortably, Raree Show scene data predictable upper limit 10K+, well within pgvector's comfort zone; no scale concern for the foreseeable future.
    - strong coupling with Supabase: the cost that migrating data from Supabase became more heiger (SQL data + vector data) 
- Reversibility:
    - medium: steps that switch to Pinecone or Chroma: export vector data -> import to new service -> rewrite the query logic. It is estimated that the workload will take 1-2 days.
    - the cost is limited if the decision is wrong, and can be rolled back.
- Constraints on future decisions:
    - Adding RAG queries to tables other than the scene table can follow this approach: add a vector array column + pgvector query.
    - If the solution becomes path-dependent, it could accelerate Supabase cost growth earlier than expected.
    - Selecting gemini-embedding-001 (768-dim) now locks the capacity of this vector storage; switching the embedding model midway will require repopulating all vectors.
    - The project will become more reliant on Supabase, and avoiding the use of new services will be a greater priority when making future technology selections.