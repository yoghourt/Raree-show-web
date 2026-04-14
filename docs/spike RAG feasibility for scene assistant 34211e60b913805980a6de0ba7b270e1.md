# spike: RAG feasibility for scene assistant

## How Scene Assistant works now

Scene assistant lets users who view the scene page ask questions about the current scene, like Who is X.

Here is how it works:  Users type a question in the input box, then click the send button.  → The scene assistant then sends a request containing the user question and currentScene Object to backend API route → When the Server get this request, it start builds the prompt, then send request to Gemini API → Gemini recieves the prompt, then make answer based on the prompt and its training knowledge, then return answer to the server  → Server transfers the answer stream to frontend → Scene assistent component show the answer using typewriter animation.

It’s a naive RAG: retrieval is hardcoded to “the current scene only”, regardless of what the user is asking. The retrieval step is not query-aware.

## Approach comparison

### Option A: Pure SQL

- How it works: Server side add a retrieve step — using SQL filter the suitable scenes then send them into the prompt
- Pros:
    - simple and don’t need import new tech like embedding API or vector DB
    - native support spoiler
- Cons:
    - The prompt will to become too large (being too many scenes are stuffed into it)
    - The answer quality will be lower (no semantic content affect the result)
    - The filter has no semantic relation

### Option B: Pure vector

- How it works:  Server side runs vector similarity search directly over all scenes and returning the top-K related scenes.
- Pros:
    - can filter scene data by question meaning
- Cons:
    - can not deal with spoiler (like unread scenes)

### Option C: Hybrid (SQL filter + vector rerank) ← chosen

- How it works: Server side add a retrieve step — using SQL filter the suitable scenes then give them into the next step, then add a vector rerank step - filter the releated scenes by question meaning, then send them into the prompt
- Why this wins:
    - SQL prevents spoiler
    - vector makes semantic retrieval
    - The two constraints are orthogonal: SQL guarantees What the LLM is allowed to see (architecture-level safty), while vector ranking decides what’s most relevant within that allowed set(quality)

## Data flow

## Prerequisites (must be done before any RAG implementation starts)

- **Scene summary field**: scene.summary was removed in PR #12.
RAG retrieval needs a text-per-scene to embed; we need to either
(a) restore summary, or (b) derive a summary from story_images_v2
captions, or (c) introduce a dedicated rag_text field.
→ Decision deferred to Phase 1 implementation kickoff.
- **Data completeness**: admin currently has partial scene data for ASOIAF.
RAG quality scales with data coverage. Phase 1 can start with whatever
is in the DB at kickoff time; missing scenes will simply be invisible
to retrieval (a known limitation, not a correctness bug).

### Setup(one-time)

- Pre-compute: each scene’s summary is embedded once and stored(in pgvector or a vector DB), keyed by scene tsid. Triggered when a scene is created or its summary is edited in admin(write-time embedding); a one-time backfill script handles existing scenes.
- At query time: user question is embedded on-the-fly

## Universal flow (Phase 1)

Input shapes (Phase 1 includes both)

### Shape A — Structured intent (chip-triggered): SQL chapter filter

SQL entity filter (character_id / location_id from chip payload).
Vector optional.

### Shape B — Free-form text: SQL chapter filter + vector rerank
(the universal flow described above).

Rationale: Chips solve the "empty input box paralysis" for new
users and cover the common questions cheaply. Free-form remains
essential for questions like "expand on story_1" where the user
seeks elaboration beyond the admin-curated content — only vector
can find semantic relevance there.

### Test cases

**Q1 - “What happened to Jon Snow before?” (readUpTo = ch.10)**

- Chapter filter → ~50 scenes (ch.1 - 10)
- Vector rerank → top 5 most relevant to the question, likely those mentioning Jon Snow’s actions/decisions
- Result: focused recap of Jon Snow’s prior arc, no spoilers from ch.11+

**Q2 - “Has Winterfell appeared before” (readUpTo = ch.10)**

- Chapter filter → ~50 scenes (ch.1 - 10)
- Vector rerank → top 5 most relevant to the question, likely those mentioning Winterfell
- Result: a focused scenes that **appeared** Winterfell, no spoilers from ch.11+

**Q3 - “Who is Jon Snow?” (readUpTo = ch.10)**

- Chapter filter → ~50 scenes (ch.1 - 10)
- Vector rerank → top 5 most relevant to the question, likely those mentioning Jon Snow’s introduce.
- Result: a focused introduce of Jon Snow, no spoilers from ch.11+

## Phase 1 / Phase 2 split

### Phase 1 scope

- Resolve summary source (Prerequisite)
- Set up vector storage + embedding pipeline (write-time + backfill)
- Implement Universal flow (Shape A + Shape B)
- Design + implement 3-5 chip types for Shape A
- Test with Q1/Q2/Q3 on ASOIAF

### Out of scope for Phase 1

- Multi-source retrieval (characters/locations as first-class)
— see Open questions
- Multi-work support beyond ASOIAF
- Retrieval quality tuning (embedding model choice, chunking)

### Phase 2 candidates (deferred, prioritized after Phase 1 metrics)

- Resolve 3a/3b fork for multi-source retrieval
- Chip UX iteration based on real usage data
- Embedding model comparison

## Go / No-go decision

Phase 1 is green-lit to start once:

- Prerequisite 1 (summary source) is decided
- A minimal chip set is designed (even if final UI polish waits)

Phase 1 is considered successful if:

- Q1/Q2/Q3 all return spoiler-free, relevant answers on ASOIAF
- Shape A answers arrive with latency comparable to the current
scene assistant
- Shape B answers show clear quality improvement over the current
naive RAG baseline

Phase 1 fails (No-go on proceeding to Phase 2) if:

- Vector retrieval quality is not meaningfully better than naive
chapter-filter-only baseline
- Embedding pipeline proves too complex to maintain at current
scale