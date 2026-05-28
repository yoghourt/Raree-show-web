import { createGeminiJudgeAdapter } from "../adapters/gemini-judge"
import type { SemanticJudgeInput } from "../adapters/semantic-judge"
import { computeAnswerRelevancy } from "../metrics/answer-relevancy"
import { computeContextPrecision } from "../metrics/context-precision"
import { computeFaithfulness } from "../metrics/faithfulness"
import { spoilerViolationRateFromOracle } from "../metrics/spoiler-violation"
import { runContentHashOracle } from "../oracle/content-hash-oracle"
import type { EvaluateSampleResult, RareeSingleTurnSample, SampleReport } from "../types"
import type { SemanticJudgeAdapter } from "../adapters/semantic-judge"

function toJudgeInput(sample: RareeSingleTurnSample): SemanticJudgeInput {
  return {
    question: sample.question,
    answer: sample.answer,
    contexts: sample.reference_contexts,
    ground_truth: sample.ground_truth,
  }
}

function oracleToBaseReport(sample: RareeSingleTurnSample, oracle: ReturnType<typeof runContentHashOracle>): SampleReport {
  return {
    id: sample.id,
    tier: sample.tier,
    oracle_pass: oracle.pass,
    classification: oracle.classification,
    spoiler_violation_rate: spoilerViolationRateFromOracle(oracle),
    retrieved_context_hash: oracle.retrieved_context_hash,
    expected_context_hash: oracle.expected_context_hash,
    retrieved_context_size: oracle.retrieved_context_size,
    expected_context_size: oracle.expected_context_size,
    diagnostics: oracle.diagnostics,
    semantic_skipped: !oracle.pass,
  }
}

export type EvaluateSampleOptions = {
  oracleOnly?: boolean
}

export async function evaluateSample(
  sample: RareeSingleTurnSample,
  judge?: SemanticJudgeAdapter,
  options?: EvaluateSampleOptions
): Promise<EvaluateSampleResult> {
  const oracle = runContentHashOracle(sample)
  const report = oracleToBaseReport(sample, oracle)

  if (!oracle.pass) {
    return { report }
  }

  if (options?.oracleOnly) {
    report.semantic_skipped = true
    return { report }
  }

  const semanticJudge = judge ?? createGeminiJudgeAdapter()
  const input = toJudgeInput(sample)

  const faithfulness = await computeFaithfulness(semanticJudge, input)
  const answer_relevancy = await computeAnswerRelevancy(semanticJudge, input)

  report.semantic_skipped = false
  report.faithfulness = faithfulness
  report.answer_relevancy = answer_relevancy
  report.context_precision = computeContextPrecision(sample)

  return { report }
}
