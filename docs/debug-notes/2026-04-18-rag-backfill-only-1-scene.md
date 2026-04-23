# RAG backfill only 1 scene

## Symptom

After the CMS gained the RAG backfill feature and a debug API, I ran five SQL tests to verify semantic retrieval.
Expected: each query returned a different scene. 
Actual: All five queries returned the same scene, regardless of input.

## Investigation path

*Pattern recognition:* When all 5 queries returned the same scene, the 
symptom immediately suggested "only 1 scene has usable embedding data" 
— not a RAG logic bug. Verification below.

1. **Hypothesis:** Only one scene had been backfilled.
  **Tested by:** Queried the scenes table directly, counting total scenes vs scenes with non-null embeddings:
```sql
  select 
    count(*) as total_scenes,
    count(rag_text) as has_text,
    count(rag_embedding) as has_embedding
  from scenes
  where work_id = 'bf3ff2a6-4337-4b91-8d61-a4dc809898e5';
```
  **Learned:** total_scenes = 3, has_embedding = 1. Only one scene had been backfilled — confirmed hypothesis.

## Root cause

- Event level: When I run backfill, there was only one scene; two new scenes were added afterward, but I did't trigger backfill.
- Mechanism level: The backfill behavior is triggered by manual admin action, decoupled from the scene lifecycle. When scenes  are created or updated, no auto trigger re-runs embedding generation. As a result, scenes added between two backfill runs will silently have NULL embeddings; scenes updated between runs will be queried against stale embeddings. The system assumes scenes + embeddings stay in sync but provides no mechanism to enforce the assumption.

## Lesson

- **Principle: Don't trust "previously verified" as a forever state.**
  **Why**: Verification is a snapshot of behavior under specific data + 
     code state. When either changes, verified behavior can silently 
     break.
  **When**: Any time you see old behavior "suddenly broken" — start by 
     asking "what changed since last verified", not "what's broken 
     now".
- **Principle: Derived state needs an explicit sync mechanism; manual 
  discipline will silently drift.**
  **Why:** When state A (e.g., scenes) produces state B (e.g., 
  embeddings), any change to A must propagate to B. Relying on "I'll 
  remember to re-run the pipeline" creates silent failure modes: the 
  system appears fine, but B is stale or incomplete. This applies to 
  any pairing — cache/source, index/table, materialized view/base 
  table, embedding/content.
  **When:** Any time you design a system where state B is computed 
  from state A through a manual step. Before shipping, ask: "What 
  happens if someone forgets to run the update step? Will the system 
  notice, or fail silently?"