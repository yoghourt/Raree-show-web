# RAGAS Governance Evaluation Suite (v1)

Specification-first offline evaluation for Scene Assistant retrieval governance and semantic quality.

## Run

```bash
npm run eval:ragas
```

Oracle-only (no LLM / no API key):

```bash
npm run eval:ragas:oracle
```

Requires `.env.local` with `GEMINI_API_KEY` for samples that pass the content-hash Oracle (semantic layer).

Optional debug judge output (console only, not persisted):

```bash
DEBUG_EVAL=1 npm run eval:ragas
```

**Quota (important):**

| Limit | What it means | What helps |
|-------|----------------|------------|
| **RPM** | Requests per minute | `EVAL_JUDGE_INTERVAL_MS` (default `15000`) |
| **RPD** | Requests per day (free tier) | Wait for reset, billing, or another API key — **interval does not help** |

If the API returns `limit: 0` or daily quota errors, the runner fails fast (no long retry loop). Default judge model: `EVAL_GEMINI_MODEL=gemini-2.5-flash`.

Partial results resume from `reports/latest.json` unless `EVAL_NO_RESUME=1`.

## Production vs eval authority

- **Production** (Scene Assistant): `sha256(concat(raw caption UTF-8))` from `chapterScenes[].revealedStorySlides` only — see `src/lib/production-story-oracle.ts`. This gates LLM ingress.
- **Eval v1 (this suite)**: `sha256(contexts.join("\n"))` on dataset fixture chunks — **legacy serialization** for `seed-v1.json`; not interchangeable with production hashes.

## Topology

1. **Content-hash Oracle** (deterministic, runs first; **eval authority only**)
   - `sha256(normalized(contexts)) === expected_context_hash`
   - `expected_context_size` is telemetry only
   - `authorized_story_indices` → index diagnostics only (never fails Oracle)
2. On Oracle **FAIL**: classify `Visibility Leakage`, `spoiler_violation_rate = 1.0`, skip semantic metrics
3. On Oracle **PASS**: Faithfulness + Answer Relevancy (LLM via `SemanticJudgeAdapter`), Context Precision (reference containment)

## Authority

| Metric | Authority |
|--------|-----------|
| spoiler_violation_rate | Content-hash Oracle |
| faithfulness | SemanticJudgeAdapter |
| answer_relevancy | SemanticJudgeAdapter |
| context_precision | Reference-context containment |

## Dataset

`dataset/seed-v1.json` — 13 samples (Tier 1–3), including hash-collision and extra-chunk FAIL cases.

Regenerate hash fields after editing contexts:

```bash
npx tsx eval/ragas/dataset/build-expected-hash.ts
```

## Report

`reports/latest.json` (gitignored) includes:

- `evaluation_version`, `oracle_version`, `dataset_version`
- Per-sample deterministic fields only (no LLM judge reasons)

## Non-goals (v1)

- CI gating, dashboards, trending
- `--hydrate` / live Supabase retrieval
- Context recall optimization
