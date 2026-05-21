/**
 * Legacy RAGAS v1 oracle: sha256(contexts.join("\n")).
 * NOT production authorization authority — production uses raw caption UTF-8 concat
 * (see src/lib/production-story-oracle.ts). This module gates eval samples only.
 */
import { VISIBILITY_LEAKAGE } from "../constants"
import type { OracleResult, RareeSingleTurnSample } from "../types"
import { runIndexDiagnostic } from "./index-diagnostic"
import { contextByteSize, contextHash, normalizedRetrievedContext } from "./normalize-context"

export function runContentHashOracle(sample: RareeSingleTurnSample): OracleResult {
  const normalized = normalizedRetrievedContext(sample.contexts)
  const retrievedHash = contextHash(normalized)
  const retrievedSize = contextByteSize(normalized)
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
