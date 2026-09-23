# Raree Show

An AI-native reading companion for long-form literary works. Readers move through a work on a map, scene by scene, and can ask a streaming assistant that only receives narrative they have already reached.

Next.js 16 · TypeScript · Vercel AI SDK · Tailwind CSS 4 · Supabase (Postgres + pgvector) · Gemini · OpenRouter

**[Live Demo](https://raree-show-web.vercel.app)**

[Admin CMS](https://raree-show-admin.vercel.app) (access required). A separate editorial app for the same Supabase data. Sign-in is required; there is no public demo account.

## Experience

The public app opens on a bookshelf of works. Choosing a work starts at its first scene.

- **Map navigation.** The background map moves to the current scene. Frame images, captions, cast, place, and scene progress stay with that position.
- **Reading progress.** Moving between scenes and frames is the position the assistant is allowed to use.
- **Streaming assistant.** Questions about the current scene stream into the panel.
- **Stop.** Stop aborts the in-flight request. Text already streamed stays in the thread and is marked Stopped. A stop before any text leaves no assistant message.
- **Visibility limit.** Scenes beyond the reader’s progress are excluded from retrieval. Unread frame captions are omitted from the prompt before generation.

Works, scenes, characters, and locations are read from Supabase. Images are served from Cloudinary URLs stored with that content.

## Engineering Highlights

- **Progress-scoped retrieval.** A SQL filter selects scenes at or behind the reader’s chapter and order. Vector search reranks only inside that set (`match_scenes` on pgvector). Results outside the set fail the request.
- **Caption boundary.** Revealed frame captions are the story text sent to the model. Those raw caption bytes are SHA-256 checked before any generation call. A mismatch returns HTTP 500.
- **Provider boundary.** Gemini (`gemini-3.5-flash-lite`) streams the answer. If `OPENROUTER_API_KEY` is set, OpenRouter can take over only when Gemini fails before the first text token. After that token, the stream stays with the provider that started it. Query embeddings (`gemini-embedding-001`, 768 dimensions) have no fallback.
- **Cancellation.** The Stop control aborts the browser `fetch`. `POST /api/scene-assistant` forwards `req.signal` into provider generation. Abort is not treated as a provider failure and does not start fallback.
- **Offline evaluation.** `npm run eval:ragas` checks retrieval governance locally, including the same raw-caption hash used at runtime. It is not part of CI.

Provider keys stay on the server. Structured provider logs are written to the server console; they are not shipped to an observability backend.

## Runtime Architecture

```text
Reader progress
  → SQL visibility gate (chapter / order at or behind progress)
  → pgvector rerank inside that candidate set
  → revealed captions only, then SHA-256 check
  → stream: Gemini, or OpenRouter if the key is set and Gemini fails before the first token
```


| Stage           | What it does                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| SQL gate        | `metadataPreFiltering` in `src/services/retrieval.ts` limits scenes by `workTsid`, `readUpToChapter`, and `readUpToOrderIndex`. |
| Vector rerank   | `match_scenes` runs on those scene ids only. Default match count is 10.                                                         |
| Prompt boundary | Current-chapter captions are truncated to frames the reader has reached (`readUpToStoryIndexLast`).                             |
| Oracle          | `src/lib/production-story-oracle.ts` hashes authorized caption bytes before `executeVerifiedGeneration`.                        |
| Generation      | `src/runtime/` owns streaming, pre-token fallback, and abort. Retrieval is not called again during fallback.                    |


Scene navigation in the browser updates the URL with `history.replaceState` and commits progress before the assistant request, so the payload matches the scene on screen.

Deeper layout notes: [`docs/runtime-architecture.md`](docs/runtime-architecture.md).

## Evidence


| ADR                                                               | Topic                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------ |
| [ADR-001](docs/adr/001-pgvector-as-vector-store.md)               | pgvector as the vector store                           |
| [ADR-002](docs/adr/002-hybrid-rag-retrieval.md)                   | Serial hybrid retrieval and the two visibility layers  |
| [ADR-003](docs/adr/003-multi-provider-ai-runtime.md)              | Generation provider abstraction and pre-token fallback |
| [ADR-013](docs/adr/013-scene-assistant-cancellation-semantics.md) | Cooperative cancellation; abort is not fallback        |


Retrieval evaluation: [`docs/evaluations/ragas-baseline-v1.md`](docs/evaluations/ragas-baseline-v1.md) (candidate baseline, not a CI gate). Harness notes: [`eval/ragas/README.md`](eval/ragas/README.md).

In code, a scene is a reading route and a story image is a reading frame. The shared glossary is `governance/vocabulary/runtime-lexicon.md`.

## Local Development

```bash
git clone https://github.com/yoghourt/raree-show-web.git
cd raree-show-web
npm install
```

Create `.env.local` (this repo does not ship an env template):

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-only; assistant retrieval
GEMINI_API_KEY=               # generation and query embeddings
# OPENROUTER_API_KEY=         # optional generation fallback
# OPENROUTER_MODEL_ID=        # optional; default openai/gpt-oss-20b:free
# HTTPS_PROXY=                # optional; local Gemini access
```

```bash
npm run dev
```

`npm run dev` bootstraps the `governance/` submodule first. The first clone needs network access. Open [http://localhost:3000](http://localhost:3000).

## Repository

```text
src/app/         Next.js App Router, reading pages, POST /api/scene-assistant
src/components/  Bookshelf and reading-route UI
src/runtime/     Providers, stream orchestration, fallback, abort
src/services/    Hybrid retrieval
src/lib/         Supabase reads, visibility checks, caption oracle, prompts
docs/            ADRs, specs, runtime notes, evaluation reports
eval/ragas/      Offline RAG evaluation harness
scripts/         Governance bootstrap and retrieval checks
governance/      Shared governance submodule
```

The editorial CMS lives in the separate `raree-show-admin` repository.