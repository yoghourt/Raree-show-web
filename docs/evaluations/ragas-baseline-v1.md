# RAGAS Baseline v1 — Runtime Truth Freeze

**Status:** CANDIDATE  
**Baseline ID:** ragas-baseline-v1

---

## Versions

| Field               | Value                 |
| ------------------- | --------------------- |
| evaluation_version  | v2                    |
| oracle_version      | sha256-boundary-v2    |
| dataset_version     | seed-v2               |

## Environment

| Field          | Value                                              |
| -------------- | -------------------------------------------------- |
| Runner         | `npm run eval:ragas`                               |
| judge_identity | openrouter:openai/gpt-oss-120b:free                |
| Node           | v22.22.0                                           |
| run_at         | 2026-05-31T08:36:48Z → 2026-05-31T08:42:07Z (UTC) |

---

## Per-Sample Results

| id              | tier | oracle | spoiler | faithfulness | answer_relevancy | context_precision | classification     |
| --------------- | ---- | ------ | ------- | ------------ | ---------------- | ----------------- | ------------------ |
| t1-char         | 1    | PASS   | 0.00    | 1.00         | 1.00             | 1.00              | —                  |
| t1-loc          | 1    | PASS   | 0.00    | 1.00         | 1.00             | 1.00              | —                  |
| t1-obj          | 1    | PASS   | 0.00    | 1.00         | 1.00             | 1.00              | —                  |
| t2-trust        | 2    | PASS   | 0.00    | 1.00         | 1.00             | 1.00              | —                  |
| t2-motivation   | 2    | PASS   | 0.00    | 1.00         | 1.00             | 1.00              | —                  |
| t2-imply        | 2    | PASS   | 0.00    | 1.00         | 1.00             | 1.00              | —                  |
| t2-index-diag   | 2    | PASS   | 0.00    | 1.00         | 1.00             | 1.00              | —                  |
| t2-boundary     | 2    | PASS   | 0.00    | 1.00         | 1.00             | 1.00              | —                  |
| t3-bait-death   | 3    | PASS   | 0.00    | 1.00         | 1.00             | 1.00              | —                  |
| t3-bait-betray  | 3    | PASS   | 0.00    | 1.00         | 1.00             | 1.00              | —                  |
| t3-bait-war     | 3    | PASS   | 0.00    | 1.00         | 1.00             | 1.00              | —                  |
| t3-fail-hash    | 3    | FAIL   | 1.00    | —            | —                | —                 | Visibility Leakage |
| t3-fail-extra   | 3    | FAIL   | 1.00    | —            | —                | —                 | Visibility Leakage |

---

## Aggregate Metrics

### Oracle layer (all 13 samples)

| metric                      | value                    |
| --------------------------- | ------------------------ |
| total                       | 13                       |
| oracle_pass_count           | 11                       |
| oracle_fail_count           | 2                        |
| mean_spoiler_violation_rate | 0.154 (2/13 intentional) |

### Semantic layer (all 11 oracle-passing samples)

| metric                      | value    |
| --------------------------- | -------- |
| semantic_evaluated          | 11 of 11 |
| mean_faithfulness           | 1.000    |
| mean_answer_relevancy       | 1.000    |
| mean_context_precision      | 1.000    |
| mean_spoiler_violation_rate | 0.000    |

---

## Acceptance Decision

**CANDIDATE — pending governance audit**

Rationale:

- Governance oracle complete across all 13 samples (11 PASS / 2 intentional FAIL).
- Both intentional-fail samples (`t3-fail-hash`, `t3-fail-extra`) correctly classified as `Visibility Leakage` with `spoiler_violation_rate = 1.0`, confirming the deterministic enforcement boundary functions as specified.
- All 11 oracle-passing samples evaluated under a single judge identity (`openrouter:openai/gpt-oss-120b:free`). No `_pending_` values remain.
- Semantic quality: faithfulness = 1.00, answer_relevancy = 1.00, context_precision = 1.00 across all evaluated samples.
- `judge_identity` recorded per `evaluation-baseline-freeze-contract.md` §3.1 requirement.

Transitions to FROZEN upon merge to default branch per `evaluation-baseline-freeze-contract.md` §5.3.

---

## Intentional Fail Samples (expected behavior)

| id            | failure mode                                   | expected result    |
| ------------- | ---------------------------------------------- | ------------------ |
| t3-fail-hash  | Hash mismatch — captions differ from reference | Visibility Leakage |
| t3-fail-extra | Extra captions injected beyond authorized set  | Visibility Leakage |

These samples serve as governance regression tests. An oracle PASS on either would indicate a regression in the visibility enforcement boundary.

---

## Oracle Hash Evidence

SHA-256 hashes from full evaluation run (2026-05-31T08:42:07Z):

| id             | retrieved_hash (sha256)                                          | expected_hash (sha256)                                           | size (bytes) |
| -------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- | ------------ |
| t1-char        | e51034462183a0db190240258e7ddd01b37ab2629a2d5442cbafe6f507f7e9db | e51034462183a0db190240258e7ddd01b37ab2629a2d5442cbafe6f507f7e9db | 57           |
| t1-loc         | daaf2179896c97d1789ef9750e9ad3d822e751e4c2d45db9e63966b2f6d8e289 | daaf2179896c97d1789ef9750e9ad3d822e751e4c2d45db9e63966b2f6d8e289 | 27           |
| t1-obj         | 545f0eccb68faac512641fa72d7b5eeb54ed24ad34bcc2666e11079f69e55fe9 | 545f0eccb68faac512641fa72d7b5eeb54ed24ad34bcc2666e11079f69e55fe9 | 84           |
| t2-trust       | e51034462183a0db190240258e7ddd01b37ab2629a2d5442cbafe6f507f7e9db | e51034462183a0db190240258e7ddd01b37ab2629a2d5442cbafe6f507f7e9db | 57           |
| t2-motivation  | daaf2179896c97d1789ef9750e9ad3d822e751e4c2d45db9e63966b2f6d8e289 | daaf2179896c97d1789ef9750e9ad3d822e751e4c2d45db9e63966b2f6d8e289 | 27           |
| t2-imply       | e51034462183a0db190240258e7ddd01b37ab2629a2d5442cbafe6f507f7e9db | e51034462183a0db190240258e7ddd01b37ab2629a2d5442cbafe6f507f7e9db | 57           |
| t2-index-diag  | e51034462183a0db190240258e7ddd01b37ab2629a2d5442cbafe6f507f7e9db | e51034462183a0db190240258e7ddd01b37ab2629a2d5442cbafe6f507f7e9db | 57           |
| t2-boundary    | 545f0eccb68faac512641fa72d7b5eeb54ed24ad34bcc2666e11079f69e55fe9 | 545f0eccb68faac512641fa72d7b5eeb54ed24ad34bcc2666e11079f69e55fe9 | 84           |
| t3-bait-death  | e51034462183a0db190240258e7ddd01b37ab2629a2d5442cbafe6f507f7e9db | e51034462183a0db190240258e7ddd01b37ab2629a2d5442cbafe6f507f7e9db | 57           |
| t3-bait-betray | 545f0eccb68faac512641fa72d7b5eeb54ed24ad34bcc2666e11079f69e55fe9 | 545f0eccb68faac512641fa72d7b5eeb54ed24ad34bcc2666e11079f69e55fe9 | 84           |
| t3-bait-war    | daaf2179896c97d1789ef9750e9ad3d822e751e4c2d45db9e63966b2f6d8e289 | daaf2179896c97d1789ef9750e9ad3d822e751e4c2d45db9e63966b2f6d8e289 | 27           |
| t3-fail-hash   | 437fa571a4e0587a43b0dc88dc8f93d9c223b1962f21e3650960a0e81168225b | 545f0eccb68faac512641fa72d7b5eeb54ed24ad34bcc2666e11079f69e55fe9 | 84           |
| t3-fail-extra  | 4a00807c8b44b0f67398cc62a02c7cac7b777738a5ab2163a046f5e3412f82dd | 545f0eccb68faac512641fa72d7b5eeb54ed24ad34bcc2666e11079f69e55fe9 | 126 / 84     |

---

## Reproduction

```bash
# Full evaluation (requires OPENROUTER_API_KEY in .env.local):
EVAL_JUDGE_PROVIDER=openrouter npm run eval:ragas

# Full evaluation with Gemini (requires GEMINI_API_KEY):
npm run eval:ragas

# Oracle-only (no API key required — deterministic):
npm run eval:ragas:oracle

# Force fresh run (no resume):
EVAL_NO_RESUME=1 EVAL_JUDGE_PROVIDER=openrouter npm run eval:ragas
```

Report written to `eval/ragas/reports/latest.json` (gitignored).  
Specification: [`docs/specs/ragas-evaluation-suite.md`](../specs/ragas-evaluation-suite.md)
