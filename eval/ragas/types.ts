import type {
  DATASET_VERSION,
  EVALUATION_VERSION,
  ORACLE_VERSION,
  VISIBILITY_LEAKAGE,
} from "./constants"

export type EvaluationVersion = typeof EVALUATION_VERSION
export type OracleVersion = typeof ORACLE_VERSION
export type DatasetVersion = typeof DATASET_VERSION
export type VisibilityLeakageClassification = typeof VISIBILITY_LEAKAGE

export type RareeSingleTurnSample = {
  id: string
  tier: 1 | 2 | 3
  question: string
  contexts: string[]
  answer: string
  ground_truth: string
  user_progress: { chapter_number: number; order_index: number }
  authorized_story_indices: number[]
  expected_context_hash: string
  expected_context_size: number
  reference_contexts: string[]
}

export type IndexDiagnostics = {
  storyIndexWarnings: string[]
}

export type OracleResult = {
  pass: boolean
  classification?: VisibilityLeakageClassification
  spoiler_violation_rate: number
  retrieved_context_hash: string
  expected_context_hash: string
  retrieved_context_size: number
  expected_context_size: number
  diagnostics: IndexDiagnostics
}

export type SampleReport = {
  id: string
  tier: 1 | 2 | 3
  oracle_pass: boolean
  classification?: VisibilityLeakageClassification
  spoiler_violation_rate: number
  retrieved_context_hash: string
  expected_context_hash: string
  retrieved_context_size: number
  expected_context_size: number
  diagnostics: IndexDiagnostics
  semantic_skipped: boolean
  faithfulness?: number
  answer_relevancy?: number
  context_precision?: number
}

export type SuiteAggregates = {
  total: number
  oracle_pass_count: number
  oracle_fail_count: number
  semantic_evaluated_count: number
  mean_faithfulness?: number
  mean_answer_relevancy?: number
  mean_context_precision?: number
  mean_spoiler_violation_rate: number
}

export type SuiteReport = {
  evaluation_version: EvaluationVersion
  oracle_version: OracleVersion
  dataset_version: DatasetVersion
  run_at: string
  samples: SampleReport[]
  aggregates: SuiteAggregates
}

export type EvaluateSampleResult = {
  report: SampleReport
}
