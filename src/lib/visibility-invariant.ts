// Verifying ADR-002-VISIBILITY-INVARIANT-SPEC: Physical Truncation Law

import type { ChapterSceneSnippet } from "@/services/retrieval"
import {
  collectAuthorizedSemanticBytes,
  verifyProductionStoryOracle,
  INVARIANT_VIOLATION_PREFIX,
} from "@/lib/production-story-oracle"

export { INVARIANT_VIOLATION_PREFIX }

export class VisibilityInvariantViolation extends Error {
  constructor(detail: string) {
    super(`${INVARIANT_VIOLATION_PREFIX}: ${detail}`)
    this.name = "VisibilityInvariantViolation"
  }
}

/**
 * ADR-002 / W-01: `-1` is the sentinel empty boundary; integers `>= 0` are valid.
 * Fail-fast on NaN, non-integer, or index `< -1`.
 */
export function assertReadUpToStoryIndexLast(
  index: unknown
): asserts index is number {
  if (typeof index !== "number") {
    throw new VisibilityInvariantViolation(
      `readUpToStoryIndexLast must be a number, got ${typeof index}`
    )
  }
  if (!Number.isFinite(index)) {
    throw new VisibilityInvariantViolation(
      "readUpToStoryIndexLast must be finite (NaN and Infinity are rejected)"
    )
  }
  if (!Number.isInteger(index)) {
    throw new VisibilityInvariantViolation(
      `readUpToStoryIndexLast must be an integer, got ${index}`
    )
  }
  if (index < -1) {
    throw new VisibilityInvariantViolation(
      `readUpToStoryIndexLast must be >= -1, got ${index}`
    )
  }
}

/** Semantic raw-byte oracle (production authority). */
export function assertProductionStoryOracle(
  chapterScenes: ChapterSceneSnippet[],
  requestId: string,
  stableFingerprint: string
): { byteSize: number; sha256: string } {
  const collected = collectAuthorizedSemanticBytes(chapterScenes)
  return verifyProductionStoryOracle({
    authorizedChunks: collected.chunks,
    authorizedSemanticBytes: collected.authorizedSemanticBytes,
    requestId,
    stableFingerprint,
  })
}

/** @deprecated Use collectAuthorizedSemanticBytes / assertProductionStoryOracle */
export function sigmaAuthorizedStoryCaptionBytes(
  chapterScenes: ChapterSceneSnippet[]
): number {
  return collectAuthorizedSemanticBytes(chapterScenes).sigmaBytes
}

/** @deprecated Use collectAuthorizedSemanticBytes */
export function retrievedContextSize(chapterScenes: ChapterSceneSnippet[]): number {
  return collectAuthorizedSemanticBytes(chapterScenes).sigmaBytes
}

/** @deprecated Use assertProductionStoryOracle */
export function assertByteLevelOracle(
  chapterScenes: ChapterSceneSnippet[],
  requestId: string,
  stableFingerprint: string
): void {
  assertProductionStoryOracle(chapterScenes, requestId, stableFingerprint)
}
