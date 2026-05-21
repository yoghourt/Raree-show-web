// Aligning Production Oracle with RAGAS Evaluation Suite SHA-256 Invariant

import { createHash } from "node:crypto"
import type { ChapterSceneSnippet } from "@/services/retrieval"

export const INVARIANT_VIOLATION_PREFIX = "Invariant Violation"

export class InvariantViolationError extends Error {
  readonly code = "invariant_violation" as const

  constructor(detail: string) {
    super(`${INVARIANT_VIOLATION_PREFIX}: ${detail}`)
    this.name = "InvariantViolationError"
  }
}

export type AuthorizedSemanticCollection = {
  chunks: Buffer[]
  authorizedSemanticBytes: Buffer
  sigmaBytes: number
  sha256: string
}

/**
 * Production story authorization bytes originate exclusively from
 * chapterScenes[].revealedStorySlides[].caption (raw UTF-8, no trim).
 * Scenes are processed in ascending order_index; slides in array order.
 */
export function collectAuthorizedSemanticBytes(
  chapterScenes: ChapterSceneSnippet[]
): AuthorizedSemanticCollection {
  const sorted = [...chapterScenes].sort((a, b) => a.order_index - b.order_index)
  const chunks: Buffer[] = []
  for (const scene of sorted) {
    for (const slide of scene.revealedStorySlides) {
      chunks.push(Buffer.from(slide.caption, "utf8"))
    }
  }
  const authorizedSemanticBytes = Buffer.concat(chunks)
  let sigmaBytes = 0
  for (const chunk of chunks) {
    sigmaBytes += chunk.length
  }
  const sha256 = createHash("sha256").update(authorizedSemanticBytes).digest("hex")
  return { chunks, authorizedSemanticBytes, sigmaBytes, sha256 }
}

function logInvariantFailure(fields: {
  expectedByteSize: number
  actualByteSize: number
  expectedSha256: string
  actualSha256: string
  requestId: string
  stableFingerprint: string
  reason: string
}): void {
  console.error("[production-story-oracle] invariant failure", {
    expectedByteSize: fields.expectedByteSize,
    actualByteSize: fields.actualByteSize,
    expectedSha256: fields.expectedSha256,
    actualSha256: fields.actualSha256,
    requestId: fields.requestId,
    stableFingerprint: fields.stableFingerprint,
    reason: fields.reason,
  })
}

/**
 * Semantic authorization gate (presentation-layer bytes are out of scope).
 * Fail-fast on size or hash mismatch; does not log raw story content.
 */
export function verifyProductionStoryOracle(params: {
  authorizedChunks: Buffer[]
  authorizedSemanticBytes: Buffer
  requestId: string
  stableFingerprint: string
}): { byteSize: number; sha256: string } {
  const expectedFromChunks = Buffer.concat(params.authorizedChunks)
  let sigmaBytes = 0
  for (const chunk of params.authorizedChunks) {
    sigmaBytes += chunk.length
  }

  const expectedSha256 = createHash("sha256").update(expectedFromChunks).digest("hex")
  const actualSha256 = createHash("sha256")
    .update(params.authorizedSemanticBytes)
    .digest("hex")
  const actualByteSize = params.authorizedSemanticBytes.length

  if (sigmaBytes !== actualByteSize) {
    logInvariantFailure({
      expectedByteSize: sigmaBytes,
      actualByteSize,
      expectedSha256,
      actualSha256,
      requestId: params.requestId,
      stableFingerprint: params.stableFingerprint,
      reason: "retrieved_context_size !== Σ(byteLength(authorized_story_content))",
    })
    throw new InvariantViolationError(
      `byte-level oracle mismatch: Σ(authorized_story_content)=${sigmaBytes} !== retrieved_context_size=${actualByteSize}`
    )
  }

  if (!expectedFromChunks.equals(params.authorizedSemanticBytes)) {
    logInvariantFailure({
      expectedByteSize: expectedFromChunks.length,
      actualByteSize,
      expectedSha256,
      actualSha256,
      requestId: params.requestId,
      stableFingerprint: params.stableFingerprint,
      reason: "authorizedSemanticBytes !== concat(authorizedChunks)",
    })
    throw new InvariantViolationError(
      "semantic buffer identity mismatch: authorizedSemanticBytes !== concat(authorizedChunks)"
    )
  }

  if (expectedSha256 !== actualSha256) {
    logInvariantFailure({
      expectedByteSize: sigmaBytes,
      actualByteSize,
      expectedSha256,
      actualSha256,
      requestId: params.requestId,
      stableFingerprint: params.stableFingerprint,
      reason: "sha256(authorizedSemanticBytes) mismatch",
    })
    throw new InvariantViolationError(
      `sha256 oracle mismatch: expected=${expectedSha256} actual=${actualSha256}`
    )
  }

  return { byteSize: actualByteSize, sha256: actualSha256 }
}

/** Query fingerprint input: UTF-8 NFC only (no trim). */
export function normalizeQueryForFingerprint(query: string): string {
  return query.normalize("NFC")
}

export function buildStableRequestFingerprint(params: {
  sceneTsid: string
  chapterNumber: number
  readUpToStoryIndexLast: number
  normalizedUserQuery: string
}): string {
  const payload = `${params.sceneTsid}|${params.chapterNumber}|${params.readUpToStoryIndexLast}|${params.normalizedUserQuery}`
  return createHash("sha256").update(payload, "utf8").digest("hex")
}

/**
 * Legacy RAGAS v1 join("\n") hash — telemetry only; MUST NOT gate LLM ingress.
 */
export function legacyRagasJoinHashForTelemetry(contexts: string[]): {
  hash: string
  size: number
} {
  const normalized = contexts.join("\n")
  return {
    hash: createHash("sha256").update(normalized, "utf8").digest("hex"),
    size: Buffer.byteLength(normalized, "utf8"),
  }
}
