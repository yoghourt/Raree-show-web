import fs from "node:fs"
import path from "node:path"
import { config } from "dotenv"
import { evaluateSample } from "./evaluate-sample"
import { buildSuiteReport, printSuiteSummary } from "./report"
import type { RareeSingleTurnSample, SampleReport, SuiteReport } from "../types"

config({ path: path.resolve(process.cwd(), ".env.local") })

const REPORT_PATH = path.resolve(__dirname, "../reports/latest.json")

function isSemanticallyComplete(report: SampleReport): boolean {
  if (!report.oracle_pass) return true
  return (
    report.faithfulness !== undefined &&
    report.answer_relevancy !== undefined &&
    report.context_precision !== undefined
  )
}

function loadResumeMap(): Map<string, SampleReport> {
  if (process.env.EVAL_NO_RESUME === "1" || !fs.existsSync(REPORT_PATH)) {
    return new Map()
  }
  try {
    const prior = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8")) as SuiteReport
    const map = new Map<string, SampleReport>()
    for (const s of prior.samples) {
      if (isSemanticallyComplete(s)) map.set(s.id, s)
    }
    if (map.size > 0) {
      console.log(`Resuming: ${map.size} sample(s) already complete in latest.json`)
    }
    return map
  } catch {
    return new Map()
  }
}

function writePartialReport(reports: SampleReport[]): void {
  const reportsDir = path.dirname(REPORT_PATH)
  fs.mkdirSync(reportsDir, { recursive: true })
  fs.writeFileSync(REPORT_PATH, JSON.stringify(buildSuiteReport(reports), null, 2))
}

async function main(): Promise<void> {
  const oracleOnly = process.env.EVAL_ORACLE_ONLY === "1"
  if (oracleOnly) {
    console.log("EVAL_ORACLE_ONLY=1 — semantic layer skipped")
  }

  const datasetPath = path.resolve(__dirname, "../dataset/seed-v2.json")
  const raw = fs.readFileSync(datasetPath, "utf8")
  const samples = JSON.parse(raw) as RareeSingleTurnSample[]

  const resumeMap = oracleOnly ? new Map() : loadResumeMap()
  const reports: SampleReport[] = []

  for (const sample of samples) {
    const cached = resumeMap.get(sample.id)
    if (cached) {
      console.log(`evaluating ${sample.id} (tier ${sample.tier})... skipped (resume)`)
      reports.push(cached)
      continue
    }

    console.log(`evaluating ${sample.id} (tier ${sample.tier})...`)
    const { report } = await evaluateSample(sample, undefined, { oracleOnly })
    reports.push(report)

    if (!report.oracle_pass) {
      console.log(`  -> ${report.classification}; semantic skipped`)
    } else if (!oracleOnly) {
      console.log(
        `  -> faith=${report.faithfulness?.toFixed(2)} relev=${report.answer_relevancy?.toFixed(2)} prec=${report.context_precision?.toFixed(2)}`
      )
    }

    writePartialReport(reports)
  }

  const suiteReport = buildSuiteReport(reports)
  fs.writeFileSync(REPORT_PATH, JSON.stringify(suiteReport, null, 2))

  printSuiteSummary(suiteReport)
  console.log(`\nreport written: ${REPORT_PATH}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
