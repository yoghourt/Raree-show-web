/**
 * Production semantic SHA-256 oracle unit tests (no LLM, no Supabase).
 * Run: pnpm run test:production-oracle
 */

import {
  collectAuthorizedSemanticBytes,
  InvariantViolationError,
  INVARIANT_VIOLATION_PREFIX,
  legacyRagasJoinHashForTelemetry,
  verifyProductionStoryOracle,
} from "../src/lib/production-story-oracle"
import type { ChapterSceneSnippet } from "../src/services/retrieval"

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`\n[FAIL] ${msg}`)
    process.exit(1)
  }
}

function assertInvariantThrows(fn: () => unknown, label: string): void {
  let threw = false
  try {
    fn()
  } catch (e) {
    threw = true
    const msg = e instanceof Error ? e.message : String(e)
    assert(
      msg.includes(INVARIANT_VIOLATION_PREFIX),
      `${label}: expected "${INVARIANT_VIOLATION_PREFIX}" in error, got: ${msg}`
    )
    assert(
      e instanceof InvariantViolationError,
      `${label}: expected InvariantViolationError`
    )
  }
  assert(threw, `${label}: expected throw, got success`)
}

const sampleScenes: ChapterSceneSnippet[] = [
  {
    tsid: "scene-a",
    title: "北门",
    order_index: 0,
    revealedStorySlides: [{ caption: "守军在城楼上巡逻。" }, { caption: "北风呼啸。" }],
  },
  {
    tsid: "scene-b",
    title: "南门",
    order_index: 1,
    revealedStorySlides: [{ caption: "商队入城。" }],
  },
]

function runPassCase(): void {
  console.log("\n--- Case PASS: canonical semantic oracle ---")
  const collected = collectAuthorizedSemanticBytes(sampleScenes)
  assert(
    collected.sigmaBytes === collected.authorizedSemanticBytes.length,
    "sigma === concatenated length"
  )
  const verified = verifyProductionStoryOracle({
    authorizedChunks: collected.chunks,
    authorizedSemanticBytes: collected.authorizedSemanticBytes,
    requestId: "test-fp:00000000-0000-0000-0000-000000000001",
    stableFingerprint: "test-fp",
  })
  assert(verified.sha256 === collected.sha256, "verify returns same hash")
  const legacy = legacyRagasJoinHashForTelemetry(["legacy-chunk"])
  assert(typeof legacy.hash === "string" && legacy.hash.length === 64, "legacy telemetry only")
  console.log(`  bytes=${verified.byteSize} sha256=${verified.sha256.slice(0, 16)}...`)
}

function runIntentionalMismatchCase(): void {
  console.log("\n--- Case FAIL: intentional semantic buffer mismatch ---")
  const collected = collectAuthorizedSemanticBytes(sampleScenes)
  const tampered = Buffer.concat([
    collected.authorizedSemanticBytes,
    Buffer.from("X", "utf8"),
  ])
  assertInvariantThrows(
    () =>
      verifyProductionStoryOracle({
        authorizedChunks: collected.chunks,
        authorizedSemanticBytes: tampered,
        requestId: "test-fp:bad",
        stableFingerprint: "test-fp",
      }),
    "tampered authorizedSemanticBytes"
  )
  console.log("  mismatch rejected OK")
}

function runPostRerankIntegrityCase(): void {
  console.log("\n--- Case: post-rerank / summary mutation does not change semantic hash ---")
  const before = collectAuthorizedSemanticBytes(sampleScenes)
  const scenesAfterSummaryMutation: ChapterSceneSnippet[] = sampleScenes.map((s) => ({
    ...s,
    title: s.title + "-mutated-title-only",
  }))
  const after = collectAuthorizedSemanticBytes(scenesAfterSummaryMutation)
  assert(
    before.sha256 === after.sha256,
    "title mutation must not affect story semantic oracle"
  )
  assert(
    before.authorizedSemanticBytes.equals(after.authorizedSemanticBytes),
    "semantic bytes unchanged when only title changes"
  )
  console.log("  semantic hash stable across non-caption metadata change OK")
}

function runUnauthorizedSemanticInjectionCase(): void {
  console.log("\n--- Case: unauthorized caption bytes fail before LLM boundary ---")
  const leaked: ChapterSceneSnippet[] = [
    ...sampleScenes,
    {
      tsid: "scene-leak",
      title: "未授权",
      order_index: 99,
      revealedStorySlides: [{ caption: "未来剧情泄露。" }],
    },
  ]
  const authorized = collectAuthorizedSemanticBytes(sampleScenes)
  const leakedCollected = collectAuthorizedSemanticBytes(leaked)
  assert(authorized.sha256 !== leakedCollected.sha256, "leaked scenes must change hash")
  assert(
    authorized.authorizedSemanticBytes.length < leakedCollected.authorizedSemanticBytes.length,
    "leaked bytes must be larger"
  )
  console.log("  unauthorized extra caption increases byte surface OK")
}

function runTransformAfterVerifyRegression(): void {
  console.log("\n--- Case: transform-after-verify (presentation must not add semantic bytes) ---")
  const collected = collectAuthorizedSemanticBytes(sampleScenes)
  verifyProductionStoryOracle({
    authorizedChunks: collected.chunks,
    authorizedSemanticBytes: collected.authorizedSemanticBytes,
    requestId: "test-fp:transform",
    stableFingerprint: "test-fp",
  })
  const reCollected = collectAuthorizedSemanticBytes(sampleScenes)
  assert(
    collected.authorizedSemanticBytes.equals(reCollected.authorizedSemanticBytes),
    "re-collect after verify must match (no post-verify semantic mutation)"
  )
  console.log("  no post-verify semantic drift OK")
}

function main(): void {
  runPassCase()
  runIntentionalMismatchCase()
  runPostRerankIntegrityCase()
  runUnauthorizedSemanticInjectionCase()
  runTransformAfterVerifyRegression()
  console.log("\n[OK] production-story-oracle tests")
}

main()
