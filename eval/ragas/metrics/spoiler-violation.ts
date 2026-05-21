import type { OracleResult } from "../types"

/** Spoiler violation rate authority: content-hash Oracle only. */
export function spoilerViolationRateFromOracle(oracle: OracleResult): number {
  return oracle.spoiler_violation_rate
}
