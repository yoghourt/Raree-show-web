/**
 * P2-C structural regression. Fake providers and a fake retrieval result.
 * This does not call a model and does not prove the model will obey the prompt.
 * Run: npx tsx --experimental-test-module-mocks scripts/test-reader-guide-p2c.ts
 */
import assert from "node:assert/strict"
import { mock } from "node:test"
import { NextRequest } from "next/server"
import { executeVerifiedGeneration } from "../src/runtime/fallback-coordinator"
import { historyTurnsForRequest } from "../src/lib/assistant-generation-lifecycle"
import { historyForModel, signAssistantTurn, verifyAssistantTurn } from "../src/lib/assistant-turn-seal"
import { sealAssistantTextStream } from "../src/lib/assistant-visible-stream"
import type { AIModelProvider, ProviderRuntimeError, TextStreamHandle } from "../src/runtime/types"

process.env.GEMINI_API_KEY = "test-gemini"
process.env.OPENROUTER_API_KEY = "test-openrouter"
process.env.ASSISTANT_TURN_SEAL_KEY = "p2c-test-key"

const REVEALED = "Zhang Jue leads the Yellow Turban Rebellion."
const UNREAD = "Dong Zhuo enters Luoyang later and Zhang Jue dies of illness."
const KEY = "p2c-test-key"

type Reply = string | Error

const state = {
  retrievals: 0,
  lastMode: "",
  gemini: [] as Reply[],
  openrouter: [] as Reply[],
  geminiCalls: [] as string[],
  openrouterCalls: [] as string[],
  stage2: [] as string[],
  stage2Mode: "ok" as "ok" | "fail",
  cards: [] as { name: string; description: string }[],
  captions: [REVEALED],
  summaries: [] as { tsid: string; title: string; summary: string }[],
}

function reset() {
  state.retrievals = 0
  state.lastMode = ""
  state.gemini = []
  state.openrouter = []
  state.geminiCalls = []
  state.openrouterCalls = []
  state.stage2 = []
  state.stage2Mode = "ok"
  state.cards = []
  state.captions = [REVEALED]
  state.summaries = []
}

function provider(id: "gemini" | "openrouter"): AIModelProvider {
  return {
    providerId: id,
    async generateText(request) {
      const content = request.messages[0]?.content ?? ""
      if (id === "gemini") state.geminiCalls.push(content)
      else state.openrouterCalls.push(content)
      if (request.abortSignal?.aborted) {
        const error = new Error("The operation was aborted.")
        error.name = "AbortError"
        throw error
      }
      const next = (id === "gemini" ? state.gemini : state.openrouter).shift()
      if (next instanceof Error) throw next
      if (next === undefined) throw new Error(`no ${id} reply`)
      return { text: next }
    },
    async streamText(): Promise<TextStreamHandle> {
      throw new Error("stage 1 must not stream")
    },
    normalizeError(error: unknown): ProviderRuntimeError {
      const message = error instanceof Error ? error.message : "failed"
      if (error instanceof Error && error.name === "AbortError") return { code: "timeout", message }
      if (/timeout/i.test(message)) return { code: "timeout", message }
      return { code: "provider_unavailable", message }
    },
  }
}

function verifiedFixture() {
  const slides = state.captions.map((caption) => ({ caption }))
  return {
    requestId: "req-p2c",
    stableFingerprint: "fp",
    results: [{ tsid: "scene_later", title: UNREAD, similarity: 0.99 }],
    chapterScenes: [
      {
        tsid: "scene_1787821760006",
        title: "The oath",
        chapter_number: 1,
        order_index: 0,
        revealedStorySlides: slides,
      },
    ],
    storyOracle: { byteSize: state.captions.join("").length, sha256: "abc" },
    currentSceneRevealedXml: `<current>${REVEALED}</current>`,
    chapterScenesXml: `<chapter>${state.captions.join("\n")}</chapter>`,
    contextSummaries: state.summaries,
    promptSummary: state.summaries[0]?.summary ?? "",
    characterCards: state.cards,
    omissionNote: null,
    observability: { candidateSetSize: 1, retrievalLatency: 1, rerankScores: [] },
  }
}

class SceneWorkMismatchError extends Error {
  constructor() {
    super("sceneTsid does not belong to workTsid")
    this.name = "SceneWorkMismatchError"
  }
}

mock.module("@/services/retrieval", {
  namedExports: {
    SceneWorkMismatchError,
    retrieveVerifiedAssistantContext: async (
      _query: string,
      _progress: unknown,
      _chapter: number,
      options?: { spoilerMode?: string }
    ) => {
      state.retrievals += 1
      state.lastMode = options?.spoilerMode ?? ""
      return verifiedFixture()
    },
  },
})

mock.module("@/runtime", {
  namedExports: {
    createGeminiProvider: () => provider("gemini"),
    executeVerifiedGeneration: async (args: { context: { system: string } }) => {
      state.stage2.push(args.context.system)
      if (state.stage2Mode === "fail") return new Response("Generation failed.", { status: 502 })
      const encoder = new TextEncoder()
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-delta", delta: "safe answer" })}\n\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish" })}\n\n`))
          controller.close()
        },
      })
      return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } })
    },
  },
})

mock.module("@/runtime/providers/openrouter-provider", {
  namedExports: {
    createOpenRouterProvider: () => provider("openrouter"),
  },
})

mock.module("@/lib/locale/read-request-locale", {
  namedExports: {
    readRequestLocale: async () => "zh-CN",
  },
})

function sseEvents(body: string): Array<Record<string, unknown>> {
  return body
    .split("\n\n")
    .map((block) => block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n"))
    .filter((payload) => payload && payload !== "[DONE]")
    .map((payload) => JSON.parse(payload) as Record<string, unknown>)
}

function request(body: Record<string, unknown>, signal?: AbortSignal) {
  return new NextRequest("http://localhost/api/scene-assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })
}

function payload(extra: Record<string, unknown> = {}) {
  return {
    messages: [{ role: "user", content: "Who is Zhang Jue?", questionId: "q1" }],
    sceneContext: {
      tsid: "scene_1787821760006",
      workTitle: "三国演义",
      title: "The oath",
      chapter_number: 1,
      chapter_title: null,
      location: "Zhuozhou",
      characters: ["Zhang Jue"],
      summary: "UNREAD SUMMARY",
      characterTsids: [],
    },
    userProgress: {
      workTsid: "work_1786961407363",
      readUpToChapter: 1,
      readUpToOrderIndex: 0,
      sceneTsid: "scene_1787821760006",
      readUpToStoryIndexLast: 0,
    },
    spoilerMode: "none",
    ...extra,
  }
}

function assertStage1SawRevealedOnly() {
  const input = state.geminiCalls[0] ?? state.openrouterCalls[0] ?? ""
  assert.ok(input.includes(REVEALED), "stage 1 receives the revealed caption")
  assert.equal(input.includes(UNREAD), false, "stage 1 does not receive the unread result title")
  assert.equal(input.includes("UNREAD SUMMARY"), false, "stage 1 does not receive the client summary")
}

async function main() {
  const { POST } = await import("../src/app/api/scene-assistant/route")

  reset()
  state.gemini = ['{"decision":"answer_allowed"}']
  const allowed = await POST(request(payload()))
  assert.equal(allowed.status, 200)
  assert.equal(state.retrievals, 1, "one retrieval before either stage")
  assert.equal(state.lastMode, "none")
  assert.equal(state.geminiCalls.length, 1)
  assert.equal(state.stage2.length, 1)
  assertStage1SawRevealedOnly()
  assert.ok(state.stage2[0]?.includes(REVEALED), "stage 2 receives the same revealed caption")
  assert.equal(state.stage2[0]?.includes(UNREAD), false, "stage 2 does not receive the unread title")
  assert.equal(state.stage2[0]?.includes("UNREAD SUMMARY"), false, "none stage 2 drops the client summary")
  assert.ok(state.stage2[0]?.includes("[No-spoiler limit]"))
  const allowedEvents = sseEvents(await allowed.text())
  const allowedSeals = allowedEvents.filter((event) => event.type === "assistant-turn-seal")
  assert.equal(allowedSeals.length, 1)
  const allowedSeal = allowedSeals[0]?.seal as { kind: string; spoilerDisclosure: boolean; expandedRetrieval: boolean; spoilerAuthorizationRequest: boolean }
  assert.equal(allowedSeal.kind, "answer")
  assert.equal(allowedSeal.spoilerDisclosure, false)
  assert.equal(allowedSeal.expandedRetrieval, false)
  assert.equal(allowedSeal.spoilerAuthorizationRequest, false)
  assert.equal(verifyAssistantTurn(KEY, "safe answer", allowedSeal as never), true)
  assert.equal(allowedEvents.some((event) => JSON.stringify(event).includes('"decision"')), false)

  reset()
  state.gemini = ['{"decision":"authorization_required"}']
  const auth = await POST(request(payload()))
  const authBody = await auth.text()
  assert.equal(state.stage2.length, 0, "authorization does not call stage 2")
  assert.equal(state.retrievals, 1)
  const authEvents = sseEvents(authBody)
  assert.equal(authEvents.filter((event) => event.type === "assistant-authorization-required").length, 1)
  assert.equal(authEvents.some((event) => event.type === "text-delta"), false, "no model prose before the card")
  assert.equal(authBody.includes('{"decision"'), false, "stage 1 JSON is not in the user stream")
  const authEvent = authEvents[0]
  assert.equal(typeof authEvent?.questionId, "string")
  assert.equal(typeof authEvent?.excerpt, "string")
  assert.equal(Object.keys(authEvent ?? {}).sort().join(), "excerpt,questionId,type")
  const excerpt = String(authEvent?.excerpt)
  assert.ok(REVEALED.includes(excerpt))
  assert.equal(excerpt.includes("dies of illness"), false)
  const authSeal = authEvents.find((event) => event.type === "assistant-turn-seal")?.seal as {
    kind: string
    spoilerDisclosure: boolean
    expandedRetrieval: boolean
    spoilerAuthorizationRequest: boolean
  }
  assert.equal(authSeal.kind, "authorization_request")
  assert.equal(authSeal.spoilerDisclosure, false)
  assert.equal(authSeal.expandedRetrieval, false)
  assert.equal(authSeal.spoilerAuthorizationRequest, true)
  assert.equal(verifyAssistantTurn(KEY, excerpt, authSeal as never), true)

  reset()
  state.gemini = ['{"decision":"uncertain"}']
  const uncertain = await POST(request(payload()))
  assert.equal(state.stage2.length, 0, "uncertain does not call stage 2")
  assert.equal(sseEvents(await uncertain.text()).some((event) => event.type === "assistant-authorization-required"), true)

  reset()
  state.gemini = ['{"decision":"out_of_scope"}']
  const scope = await POST(request(payload()))
  assert.equal(state.stage2.length, 0, "out_of_scope does not call stage 2")
  const scopeEvents = sseEvents(await scope.text())
  assert.equal(scopeEvents[0]?.type, "text-delta")
  assert.equal(scopeEvents[0]?.delta, "我只能顺着这部作品和你正在看的场景来聊。这个问题超出这个范围了。")
  const scopeSeal = scopeEvents.find((event) => event.type === "assistant-turn-seal")?.seal as { kind: string }
  assert.equal(scopeSeal.kind, "out_of_scope")
  assert.equal(verifyAssistantTurn(KEY, String(scopeEvents[0]?.delta), scopeSeal as never), true)

  reset()
  state.captions = ["Yellow Turban"]
  state.gemini = ['{"decision":"authorization_required"}']
  const emptyExcerpt = sseEvents(await (await POST(request(payload({ messages: [{ role: "user", content: "张角最后怎么样了？", questionId: "q1" }] })))).text())
  assert.equal(emptyExcerpt[0]?.excerpt, "")

  reset()
  state.gemini = ["not json", "still not json"]
  state.openrouter = ["nope", "also nope"]
  const invalid = await POST(request(payload()))
  assert.equal(invalid.status, 502)
  assert.equal(state.stage2.length, 0)
  assert.equal(state.geminiCalls.length, 2, "primary gets one repair")
  assert.equal(state.openrouterCalls.length, 2, "fallback gets one repair and still does not become answer_allowed")
  assert.equal(await invalid.text(), "Invalid generation request.")

  reset()
  state.gemini = [new Error("provider down")]
  state.openrouter = ['{"decision":"answer_allowed"}']
  const failedOver = await POST(request(payload()))
  assert.equal(failedOver.status, 200)
  assert.equal(state.geminiCalls.length, 1, "transport failure does not repair")
  assert.equal(state.openrouterCalls.length, 1)
  assert.equal(state.stage2.length, 1)
  assert.ok(state.openrouterCalls[0]?.includes(REVEALED))

  reset()
  state.gemini = [new Error("provider down")]
  state.openrouter = [new Error("fallback down")]
  const bothDown = await POST(request(payload()))
  assert.equal(bothDown.status, 502)
  assert.equal(state.stage2.length, 0)

  reset()
  state.gemini = [new Error("timeout")]
  state.openrouter = ['{"decision":"answer_allowed"}']
  const timed = await POST(request(payload()))
  assert.equal(timed.status, 200)
  assert.equal(state.openrouterCalls.length, 1, "a normal timeout error may use the fallback")
  assert.equal(state.stage2.length, 1)

  reset()
  const abortError = new Error("The operation was aborted.")
  abortError.name = "AbortError"
  state.gemini = [abortError]
  state.openrouter = ['{"decision":"answer_allowed"}']
  const abortedLikeTimeout = await POST(request(payload()))
  assert.equal(abortedLikeTimeout.status, 200)
  assert.equal(state.openrouterCalls.length, 1, "a provider AbortError uses fallback while the client signal is still open")
  assert.equal(state.stage2.length, 1)

  reset()
  const controller = new AbortController()
  controller.abort()
  const disconnected = await POST(request(payload(), controller.signal))
  assert.equal(disconnected.status, 499)
  assert.equal(state.geminiCalls.length, 0)
  assert.equal(state.stage2.length, 0)

  reset()
  state.gemini = ['{"decision":"answer_allowed"}']
  state.stage2Mode = "fail"
  const stage2Fail = await POST(request(payload()))
  assert.equal(stage2Fail.status, 502)
  assert.equal((await stage2Fail.text()).includes("assistant-turn-seal"), false)

  reset()
  state.captions = [REVEALED, "A later ingested route."]
  const granted = await POST(request(payload({ spoilerMode: "single_request", authorizedQuestionId: "q1" })))
  assert.equal(granted.status, 200)
  assert.equal(state.geminiCalls.length, 0, "valid single_request skips stage 1")
  assert.equal(state.retrievals, 1)
  assert.equal(state.lastMode, "single_request")
  assert.equal(state.stage2.length, 1)
  assert.ok(state.stage2[0]?.includes("The no-spoiler limit does not apply on this turn."))
  assert.ok(state.stage2[0]?.includes("A later ingested route."))
  const grantedSeal = sseEvents(await granted.text()).find((event) => event.type === "assistant-turn-seal")?.seal as {
    spoilerDisclosure: boolean
    expandedRetrieval: boolean
    spoilerMode: string
  }
  assert.equal(grantedSeal.spoilerDisclosure, true)
  assert.equal(grantedSeal.expandedRetrieval, true)
  assert.equal(grantedSeal.spoilerMode, "single_request")

  reset()
  const before = state.retrievals
  const mismatch = await POST(request(payload({ spoilerMode: "single_request", authorizedQuestionId: "other" })))
  assert.equal(mismatch.status, 400)
  assert.equal(state.retrievals, before, "a bad authorizedQuestionId does not retrieve or generate")
  assert.equal(await mismatch.text(), "authorizedQuestionId does not match the question")

  reset()
  state.captions = [REVEALED]
  const conversation = await POST(request(payload({ spoilerMode: "conversation" })))
  assert.equal(conversation.status, 200)
  assert.equal(state.geminiCalls.length, 0, "explicit conversation skips stage 1")
  assert.equal(state.lastMode, "conversation")
  assert.equal(state.stage2.length, 1)

  reset()
  state.gemini = ['{"decision":"answer_allowed"}']
  const omitted = await POST(request(payload({ spoilerMode: undefined })))
  assert.equal(omitted.status, 200)
  assert.equal(state.lastMode, "none", "a missing spoilerMode is none")
  assert.equal(state.geminiCalls.length, 1)

  reset()
  state.gemini = ['{"decision":"answer_allowed"}']
  const emptyMatch = await POST(request(payload()))
  assert.equal(emptyMatch.status, 200)
  assert.ok(state.geminiCalls[0]?.includes(REVEALED), "captions still reach stage 1 when match rows are unused")

  const progress = { sceneTsid: "scene_1787821760006", readUpToChapter: 1, readUpToOrderIndex: 0, readUpToStoryIndexLast: 0 }
  const fields = {
    questionId: "q1",
    workTsid: "work_1786961407363",
    sceneTsid: "scene_1787821760006",
    spoilerMode: "none" as const,
    expandedRetrieval: false,
    spoilerDisclosure: false,
    spoilerAuthorizationRequest: true,
    readUpToChapter: 1,
    readUpToOrderIndex: 0,
    readUpToStoryIndexLast: 0,
  }
  const card = signAssistantTurn(KEY, { ...fields, kind: "authorization_request" }, REVEALED)
  const spoiler = signAssistantTurn(KEY, {
    ...fields,
    kind: "spoiler_answer",
    spoilerMode: "single_request",
    expandedRetrieval: true,
    spoilerDisclosure: true,
    spoilerAuthorizationRequest: false,
  }, "Zhang Jue dies of illness.")
  const kept = historyForModel({
    messages: [
      { role: "user", content: "Who is Zhang Jue?", questionId: "q1" },
      { role: "assistant", content: REVEALED, seal: card },
      { role: "assistant", content: "Zhang Jue dies of illness.", seal: spoiler },
    ],
    spoilerMode: "none",
    workTsid: "work_1786961407363",
    sceneTsid: progress.sceneTsid,
    progress,
    sealKey: KEY,
  })
  assert.deepEqual(kept.map((item) => item.content), ["Who is Zhang Jue?", REVEALED])
  const tampered = { ...card, kind: "spoiler_answer" as const }
  assert.equal(verifyAssistantTurn(KEY, REVEALED, tampered), false)
  const dropped = historyForModel({
    messages: [{ role: "assistant", content: REVEALED, seal: tampered }],
    spoilerMode: "none",
    workTsid: "work_1786961407363",
    sceneTsid: progress.sceneTsid,
    progress,
    sealKey: KEY,
  })
  assert.deepEqual(dropped, [])
  const unfinished = historyTurnsForRequest([
    { role: "user", content: "q", questionId: "q1" },
    { role: "assistant", content: "partial", status: "failed", generationId: 1 },
    { role: "assistant", content: "", status: "streaming", generationId: 2 },
  ])
  assert.deepEqual(unfinished.map((item) => item.role), ["user"])

  const hanging = new ReadableStream<Uint8Array>({ start() {} })
  const cancelled = sealAssistantTextStream(new Response(hanging), () => {
    throw new Error("cancel must not seal")
  })
  const cancelRead = cancelled.body?.getReader()
  await cancelRead?.cancel()
  assert.equal(cancelled.status, 200)

  let fallbackStreams = 0
  const locked = await executeVerifiedGeneration({
    context: { requestId: "lock", system: "s", messages: [{ role: "user", content: "q" }] },
    primary: {
      providerId: "gemini",
      async generateText() { throw new Error("unused") },
      async streamText() {
        const encoder = new TextEncoder()
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-delta", delta: "Hello" })}\n\n`))
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", errorText: "later" })}\n\n`))
            controller.close()
          },
        })
        return { toUIMessageStreamResponse: () => new Response(body, { status: 200 }) }
      },
      normalizeError: () => ({ code: "unknown", message: "" }),
    },
    fallbackProviders: [{
      providerId: "openrouter",
      async generateText() { throw new Error("unused") },
      async streamText() {
        fallbackStreams += 1
        throw new Error("fallback after lock")
      },
      normalizeError: () => ({ code: "unknown", message: "" }),
    }],
  })
  const lockedText = await locked.text()
  assert.equal(fallbackStreams, 0, "stage 2 does not switch provider after the first text-delta")
  assert.ok(lockedText.includes("Hello"))

  let prelockFallback = 0
  const switched = await executeVerifiedGeneration({
    context: { requestId: "prelock", system: "s", messages: [{ role: "user", content: "q" }] },
    primary: {
      providerId: "gemini",
      async generateText() { throw new Error("unused") },
      async streamText() {
        const encoder = new TextEncoder()
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", errorText: "before lock" })}\n\n`))
            controller.close()
          },
        })
        return { toUIMessageStreamResponse: () => new Response(body, { status: 200 }) }
      },
      normalizeError: () => ({ code: "provider_unavailable", message: "before lock" }),
    },
    fallbackProviders: [{
      providerId: "openrouter",
      async generateText() { throw new Error("unused") },
      async streamText() {
        prelockFallback += 1
        const encoder = new TextEncoder()
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-delta", delta: "fallback" })}\n\n`))
            controller.close()
          },
        })
        return { toUIMessageStreamResponse: () => new Response(body, { status: 200 }) }
      },
      normalizeError: () => ({ code: "unknown", message: "" }),
    }],
  })
  assert.equal(prelockFallback, 1)
  assert.ok((await switched.text()).includes("fallback"))

  console.log("test-reader-guide-p2c: ok")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
