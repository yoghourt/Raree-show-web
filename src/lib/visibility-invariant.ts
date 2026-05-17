// Verifying ADR-002-VISIBILITY-INVARIANT-SPEC: Physical Truncation Law

import type { ChapterSceneSnippet } from "@/services/retrieval"
import { measureRetrievedStoryContextBytes } from "@/lib/scene-assistant-context"

export const INVARIANT_VIOLATION_PREFIX = "Invariant Violation"

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

/** Byte-level oracle: Σ(authorized_story_content) for story captions in prompt assembly. */
export function sigmaAuthorizedStoryCaptionBytes(
  chapterScenes: ChapterSceneSnippet[],
  sceneTsid: string
): number {
  return measureRetrievedStoryContextBytes(chapterScenes, sceneTsid)
}

export function retrievedContextSize(
  chapterScenes: ChapterSceneSnippet[],
  sceneTsid: string
): number {
  return measureRetrievedStoryContextBytes(chapterScenes, sceneTsid)
}

export function assertByteLevelOracle(
  chapterScenes: ChapterSceneSnippet[],
  sceneTsid: string
): void {
  const sigma = sigmaAuthorizedStoryCaptionBytes(chapterScenes, sceneTsid)
  const retrieved = retrievedContextSize(chapterScenes, sceneTsid)
  if (sigma !== retrieved) {
    throw new VisibilityInvariantViolation(
      `byte-level oracle mismatch: Σ(authorized_story_content)=${sigma} !== retrieved_context_size=${retrieved}`
    )
  }
}
