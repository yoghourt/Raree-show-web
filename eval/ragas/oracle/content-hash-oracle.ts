/**
 * RAGAS v2 oracle: sha256(Buffer.concat(raw caption UTF-8 bytes)).
 * Production authority: src/lib/production-story-oracle.ts#hashRawCaptions
 */
import { VISIBILITY_LEAKAGE } from "../constants"
import type { OracleResult, RareeSingleTurnSample } from "../types"
import { runIndexDiagnostic } from "./index-diagnostic"
import { captionHash } from "./normalize-context"

export function runContentHashOracle(sample: RareeSingleTurnSample): OracleResult {
  const { hash: retrievedHash, size: retrievedSize } = captionHash(sample.captions)
  const diagnostics = runIndexDiagnostic(sample)

  const pass = retrievedHash === sample.expected_context_hash

  if (!pass) {
    return {
      pass: false,
      classification: VISIBILITY_LEAKAGE,
      spoiler_violation_rate: 1.0,
      retrieved_context_hash: retrievedHash,
      expected_context_hash: sample.expected_context_hash,
      retrieved_context_size: retrievedSize,
      expected_context_size: sample.expected_context_size,
      diagnostics,
    }
  }

  return {
    pass: true,
    spoiler_violation_rate: 0.0,
    retrieved_context_hash: retrievedHash,
    expected_context_hash: sample.expected_context_hash,
    retrieved_context_size: retrievedSize,
    expected_context_size: sample.expected_context_size,
    diagnostics,
  }
}
