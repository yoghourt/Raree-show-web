import {
  DATASET_VERSION,
  EVALUATION_VERSION,
  ORACLE_VERSION,
} from "../constants"
import type { SampleReport, SuiteAggregates, SuiteReport } from "../types"

function mean(nums: number[]): number | undefined {
  if (nums.length === 0) return undefined
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function buildSuiteReport(samples: SampleReport[]): SuiteReport {
  const oraclePass = samples.filter((s) => s.oracle_pass)
  const semanticEvaluated = samples.filter((s) => !s.semantic_skipped)

  const aggregates: SuiteAggregates = {
    total: samples.length,
    oracle_pass_count: oraclePass.length,
    oracle_fail_count: samples.length - oraclePass.length,
    semantic_evaluated_count: semanticEvaluated.length,
    mean_faithfulness: mean(semanticEvaluated.map((s) => s.faithfulness).filter((n): n is number => n !== undefined)),
    mean_answer_relevancy: mean(semanticEvaluated.map((s) => s.answer_relevancy).filter((n): n is number => n !== undefined)),
    mean_context_precision: mean(semanticEvaluated.map((s) => s.context_precision).filter((n): n is number => n !== undefined)),
    mean_spoiler_violation_rate: mean(samples.map((s) => s.spoiler_violation_rate)) ?? 0,
  }

  return {
    evaluation_version: EVALUATION_VERSION,
    oracle_version: ORACLE_VERSION,
    dataset_version: DATASET_VERSION,
    run_at: new Date().toISOString(),
    samples,
    aggregates,
  }
}

export function printSuiteSummary(report: SuiteReport): void {
  console.log("\n=== RAGAS Eval Suite ===")
  console.log(
    `versions: evaluation=${report.evaluation_version} oracle=${report.oracle_version} dataset=${report.dataset_version}`
  )
  console.log(`run_at: ${report.run_at}`)
  console.log(
    `samples: ${report.aggregates.total} | oracle pass: ${report.aggregates.oracle_pass_count} | fail: ${report.aggregates.oracle_fail_count}`
  )
  console.log(
    `semantic evaluated: ${report.aggregates.semantic_evaluated_count} | mean spoiler_violation_rate: ${report.aggregates.mean_spoiler_violation_rate?.toFixed(3)}`
  )

  console.log("\n id           tier  oracle  spoiler  faith  relev  prec  leakage")
  for (const s of report.samples) {
    const leak = s.classification ?? "-"
    console.log(
      ` ${s.id.padEnd(12)} ${String(s.tier).padEnd(5)} ${s.oracle_pass ? "PASS" : "FAIL"}  ${s.spoiler_violation_rate.toFixed(2).padStart(5)}  ${fmt(s.faithfulness)}  ${fmt(s.answer_relevancy)}  ${fmt(s.context_precision)}  ${leak}`
    )
    if (s.diagnostics.storyIndexWarnings.length > 0) {
      for (const w of s.diagnostics.storyIndexWarnings) {
        console.log(`   [diag] ${w}`)
      }
    }
  }
}

function fmt(n: number | undefined): string {
  return n === undefined ? "  -  " : n.toFixed(2).padStart(5)
}
