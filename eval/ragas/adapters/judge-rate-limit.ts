const DEFAULT_INTERVAL_MS = 15_000
const MAX_RPM_RETRIES = 3

function intervalMs(): number {
  const raw = process.env.EVAL_JUDGE_INTERVAL_MS
  if (!raw) return DEFAULT_INTERVAL_MS
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_INTERVAL_MS
}

let lastJudgeCallAt = 0

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Serialize judge API calls to respect free-tier RPM (requests per minute). */
export async function throttleJudgeCall(): Promise<void> {
  const minInterval = intervalMs()
  if (minInterval === 0) return

  const now = Date.now()
  const wait = lastJudgeCallAt + minInterval - now
  if (wait > 0) {
    console.log(`  [rpm] waiting ${Math.ceil(wait / 1000)}s before next judge call...`)
    await sleep(wait)
  }
  lastJudgeCallAt = Date.now()
}

function parseQuotaRetrySeconds(message: string): number | undefined {
  const m = message.match(/retry in ([\d.]+)s/i)
  if (!m) return undefined
  const sec = Number.parseFloat(m[1])
  return Number.isFinite(sec) ? Math.ceil(sec) + 1 : undefined
}

function isQuotaError(message: string): boolean {
  return /quota|rate.?limit|429|resource.?exhausted/i.test(message)
}

/**
 * RPD (requests per day) exhaustion: retrying after seconds will not help until quota resets.
 * RPM (requests per minute): API returns "retry in Ns" with limit > 0.
 */
export function classifyQuotaError(message: string): "rpd" | "rpm" | null {
  if (!isQuotaError(message)) return null

  if (/limit:\s*0\b/i.test(message)) return "rpd"
  if (/per\s*day|\/day|daily/i.test(message)) return "rpd"

  if (/retry in [\d.]+s/i.test(message)) return "rpm"

  return "rpm"
}

export class JudgeQuotaExhaustedError extends Error {
  readonly kind: "rpd" | "rpm"

  constructor(kind: "rpd" | "rpm", message: string) {
    super(message)
    this.name = "JudgeQuotaExhaustedError"
    this.kind = kind
  }
}

/** Retry only on transient RPM limits; fail fast on RPD (daily quota). */
export async function withQuotaRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_RPM_RETRIES; attempt++) {
    await throttleJudgeCall()
    try {
      return await fn()
    } catch (e) {
      lastError = e
      const message = e instanceof Error ? e.message : String(e)
      const kind = classifyQuotaError(message)

      if (kind === "rpd") {
        throw new JudgeQuotaExhaustedError(
          "rpd",
          `[${label}] Gemini daily quota (RPD) exhausted. ` +
            `Increasing EVAL_JUDGE_INTERVAL_MS does not help. ` +
            `Wait for quota reset, use a billed key, or run: npm run eval:ragas:oracle\n` +
            `Original: ${message.slice(0, 400)}`
        )
      }

      if (kind !== "rpm" || attempt === MAX_RPM_RETRIES) break

      const waitSec = parseQuotaRetrySeconds(message) ?? intervalMs() / 1000
      console.log(`  [rpm] ${label} attempt ${attempt}/${MAX_RPM_RETRIES} — retry in ${waitSec}s`)
      await sleep(waitSec * 1000)
    }
  }
  throw lastError
}
