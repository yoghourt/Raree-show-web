# RAGAS Governance Evaluation Suite (v2)

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

- **Production** (Scene Assistant): `sha256(Buffer.concat(raw caption UTF-8))` from `chapterScenes[].revealedStorySlides` only — see `src/lib/production-story-oracle.ts#hashRawCaptions`. This gates LLM ingress.
- **Eval v2 (this suite)**: `sha256(Buffer.concat(captions.map(c => Buffer.from(c, "utf8"))))` on `sample.captions` — **production-authoritative** semantics, no separator, no XML. Directly reuses `hashRawCaptions` from the production oracle.

## Topology

1. **Content-hash Oracle** (deterministic, runs first; **eval authority only**)
   - `sha256(Buffer.concat(raw caption UTF-8)) === expected_context_hash`
   - `expected_context_size` is telemetry only
   - `authorized_story_indices` — metadata only (not used in oracle computation)
2. On Oracle **FAIL**: classify `Visibility Leakage`, `spoiler_violation_rate = 1.0`, skip semantic metrics
3. On Oracle **PASS**: Faithfulness + Answer Relevancy (LLM via `SemanticJudgeAdapter`), Context Precision (reference containment)

## Authority

| Metric | Authority |
|--------|-----------|
| spoiler_violation_rate | Content-hash Oracle |
| faithfulness | SemanticJudgeAdapter |
| answer_relevancy | SemanticJudgeAdapter |
| context_precision | Reference-caption containment (`captions ∩ reference_captions`) |

## Dataset

`dataset/seed-v2.json` — 13 samples (Tier 1–3), including hash-mismatch and extra-caption FAIL cases.

Fields per sample:

| Field | Purpose |
|-------|---------|
| `captions` | Retrieved raw caption strings — oracle hash input |
| `reference_captions` | Canonical ground-truth captions — hash source for `expected_context_hash`; used for context precision |
| `reference_contexts` | XML-formatted strings — LLM semantic judge input only |
| `expected_context_hash` | `sha256(Buffer.concat(reference_captions as UTF-8))` |
| `expected_context_size` | Byte size of concat (telemetry) |

Regenerate hash fields after editing `reference_captions`:

```bash
npm run regen:ragas-fixtures
```

Then review with `git diff eval/ragas/dataset/seed-v2.json` before committing.

Single-hash helper (ad hoc):

```bash
npx tsx eval/ragas/dataset/build-expected-hash.ts "caption A" "caption B"
```

## Report

`reports/latest.json` (gitignored) includes:

- `evaluation_version`, `oracle_version`, `dataset_version`
- Per-sample deterministic fields only (no LLM judge reasons)

## Non-goals (v2)

- CI gating, dashboards, trending
- `--hydrate` / live Supabase retrieval
- Context recall optimization
- Automatic fixture self-healing
