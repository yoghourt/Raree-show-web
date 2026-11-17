/**
 * Reader Guide 2.0 P1 pure checks: grant, budget, marker, HMAC, history.
 * Run: npx tsx scripts/test-reader-guide-p1.ts
 */
import assert from "node:assert/strict"
import { buildStableRequestFingerprint } from "../src/lib/production-story-oracle"
import {
  ASSISTANT_CONTEXT_CHAR_BUDGET,
  applyFrameRules,
  budgetAuthorizedRoutes,
  type CaptionRoute,
} from "../src/lib/assistant-caption-budget"
import {
  ASSISTANT_TURN_SEAL_ENV,
  AssistantSealConfigError,
  historyForModel,
  progressIsAhead,
  readAssistantSealKey,
  signAssistantTurn,
  splitSpoilerMarker,
  SpoilerMarkerTail,
  verifyAssistantTurn,
  visibilityCeiling,
  type AssistantTurnSeal,
} from "../src/lib/assistant-turn-seal"
import { sealAssistantTextStream } from "../src/lib/assistant-visible-stream"

const key = "test-seal-key"

function route(partial: Partial<CaptionRoute> & Pick<CaptionRoute, "tsid">): CaptionRoute {
  return {
    title: partial.tsid,
    chapter_number: 1,
    order_index: 0,
    captions: ["caption"],
    summary: "",
    ...partial,
  }
}

function sealFor(content: string, patch: Partial<AssistantTurnSeal> = {}): AssistantTurnSeal {
  return signAssistantTurn(
    key,
    {
      questionId: "q1",
      workTsid: "work",
      sceneTsid: "scene",
      kind: "answer",
      spoilerMode: "none",
      expandedRetrieval: false,
      spoilerDisclosure: false,
      spoilerAuthorizationRequest: false,
      readUpToChapter: 1,
      readUpToOrderIndex: 0,
      readUpToStoryIndexLast: 0,
      ...patch,
    },
    content
  )
}

function progress() {
  return { sceneTsid: "scene", readUpToChapter: 1, readUpToOrderIndex: 0, readUpToStoryIndexLast: 0 }
}

assert.equal(visibilityCeiling("none"), "progress")
assert.equal(visibilityCeiling("single_request"), "work")
assert.equal(visibilityCeiling("conversation"), "work")
assert.throws(() => readAssistantSealKey({} as NodeJS.ProcessEnv), AssistantSealConfigError)

const framed = applyFrameRules(
  [
    route({ tsid: "earlier", chapter_number: 1, order_index: 0, captions: ["old"] }),
    route({ tsid: "scene", chapter_number: 2, order_index: 0, captions: ["a", "b", "c"] }),
    route({ tsid: "sibling", chapter_number: 2, order_index: 0, captions: ["secret"] }),
    route({ tsid: "later", chapter_number: 2, order_index: 1, captions: ["future"] }),
  ],
  { readUpToChapter: 2, readUpToOrderIndex: 0, sceneTsid: "scene", readUpToStoryIndexLast: 1 },
  "progress"
)
assert.deepEqual(framed.find((item) => item.tsid === "earlier")?.captions, ["old"])
assert.deepEqual(framed.find((item) => item.tsid === "scene")?.captions, ["a", "b"])
assert.deepEqual(framed.find((item) => item.tsid === "sibling")?.captions, [])
assert.deepEqual(framed.find((item) => item.tsid === "later")?.captions, [])

const expanded = applyFrameRules(
  [route({ tsid: "scene", captions: ["a", "b"] }), route({ tsid: "later", captions: ["future"] })],
  { readUpToChapter: 1, readUpToOrderIndex: 0, sceneTsid: "scene", readUpToStoryIndexLast: 0 },
  "work"
)
assert.deepEqual(expanded.find((item) => item.tsid === "later")?.captions, ["future"])

const budgeted = budgetAuthorizedRoutes({
  routes: [
    route({ tsid: "scene", captions: ["now"], summary: "scene summary" }),
    route({ tsid: "near", captions: ["x".repeat(10)], summary: "near summary" }),
    route({ tsid: "far", captions: ["y".repeat(10)], summary: "far summary that must not leak" }),
  ],
  currentTsid: "scene",
  rankedTsids: ["near"],
  ceiling: "work",
  budget: 14,
})
assert.deepEqual(budgeted.routes.map((item) => item.tsid).sort(), ["near", "scene"])
assert.equal(budgeted.omittedRouteCount, 1)
assert.equal(budgeted.summaries.some((item) => item.summary.includes("must not leak")), false)
assert.equal(JSON.stringify(budgeted).includes("must not leak"), false)

const noneBudget = budgetAuthorizedRoutes({
  routes: [route({ tsid: "scene", captions: ["now"], summary: "hidden summary" })],
  currentTsid: "scene",
  rankedTsids: [],
  ceiling: "progress",
})
assert.equal(noneBudget.currentSummary, "")
assert.equal(noneBudget.summaries.length, 0)
assert.ok(ASSISTANT_CONTEXT_CHAR_BUDGET === 24000)

const split = splitSpoilerMarker("safe answer\n<<RAREE_SPOILER_REQUEST>>\n")
assert.equal(split.requested, true)
assert.equal(split.prose, "safe answer")
assert.equal(splitSpoilerMarker("<<RAREE_SPOILER_REQUEST>>").prose, "")
assert.equal(splitSpoilerMarker("plain").requested, false)

const tail = new SpoilerMarkerTail()
let visible = ""
for (const char of "safe\n<<RAREE_SPOILER_REQUEST>>") visible += tail.push(char)
const finished = tail.finish()
visible += finished.flush
assert.equal(visible.includes("RAREE_SPOILER_REQUEST"), false)
assert.equal(finished.requested, true)
assert.equal(finished.prose, "safe")

const aborted = new SpoilerMarkerTail()
aborted.push("hello\n<<RAREE")
assert.equal(aborted.abort(), "hello")

const signed = sealFor("hello")
assert.equal(verifyAssistantTurn(key, "hello", signed), true)
assert.equal(verifyAssistantTurn(key, "hello!", signed), false)
const tamperedKind = { ...signed, kind: "spoiler_answer" as const }
assert.equal(verifyAssistantTurn(key, "hello", tamperedKind), false)

const spoiler = sealFor("secret", {
  kind: "spoiler_answer",
  spoilerMode: "single_request",
  expandedRetrieval: true,
  spoilerDisclosure: true,
})
const base = {
  spoilerMode: "none" as const,
  workTsid: "work",
  sceneTsid: "scene",
  progress: progress(),
  sealKey: key,
}
assert.deepEqual(
  historyForModel({
    ...base,
    messages: [
      { role: "user", content: "q" },
      { role: "assistant", content: "secret", seal: spoiler },
      { role: "assistant", content: "unsigned" },
    ],
  }).map((item) => item.content),
  ["q"]
)
assert.deepEqual(
  historyForModel({
    ...base,
    spoilerMode: "conversation",
    messages: [{ role: "assistant", content: "secret", seal: spoiler }],
  }).map((item) => item.content),
  ["secret"]
)

const ahead = sealFor("later frame", { readUpToStoryIndexLast: 4 })
assert.equal(progressIsAhead(ahead, progress()), true)
assert.deepEqual(
  historyForModel({
    ...base,
    messages: [{ role: "assistant", content: "later frame", seal: ahead }],
  }),
  []
)

const noneFingerprint = buildStableRequestFingerprint({
  sceneTsid: "scene",
  chapterNumber: 1,
  readUpToStoryIndexLast: 0,
  normalizedUserQuery: "q",
  workTsid: "work",
  visibilityMode: "none",
})
const spoilerFingerprint = buildStableRequestFingerprint({
  sceneTsid: "scene",
  chapterNumber: 1,
  readUpToStoryIndexLast: 0,
  normalizedUserQuery: "q",
  workTsid: "work",
  visibilityMode: "conversation",
})
assert.notEqual(noneFingerprint, spoilerFingerprint)

async function runStreamChecks() {
const encoder = new TextEncoder()
function sse(payload: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
}
const source = new Response(
  new ReadableStream({
    start(controller) {
      controller.enqueue(sse({ type: "text-delta", delta: "safe\n<<" }))
      controller.enqueue(sse({ type: "text-delta", delta: "RAREE_SPOILER_REQUEST>>" }))
      controller.enqueue(sse({ type: "finish" }))
      controller.close()
    },
  })
)
const sealed = sealAssistantTextStream(source, ({ prose, spoilerAuthorizationRequest }) =>
  sealFor(prose, { spoilerAuthorizationRequest, kind: spoilerAuthorizationRequest ? "authorization_request" : "answer" })
)
const text = await sealed.text()
assert.equal(text.includes("RAREE_SPOILER_REQUEST"), false)
assert.equal(text.includes("assistant-turn-seal"), true)
assert.equal(text.includes("safe"), true)

const broken = new Response(
  new ReadableStream({
    start(controller) {
      controller.enqueue(sse({ type: "text-delta", delta: "partial\n<<RAREE" }))
      controller.enqueue(sse({ type: "error", errorText: "stopped" }))
      controller.close()
    },
  })
)
const failed = await sealAssistantTextStream(broken, () => sealFor("nope")).text()
assert.equal(failed.includes("assistant-turn-seal"), false)
assert.equal(failed.includes("<<RAREE"), false)
assert.equal(failed.includes("partial"), true)

process.env[ASSISTANT_TURN_SEAL_ENV] = key
assert.equal(readAssistantSealKey(), key)
}

runStreamChecks().then(() => {
  console.log("test-reader-guide-p1: ok")
})
