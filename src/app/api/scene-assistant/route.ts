import { randomUUID } from "node:crypto"
import { NextRequest } from "next/server"
import { createGeminiProvider, executeVerifiedGeneration } from "@/runtime"
import { createOpenRouterProvider } from "@/runtime/providers/openrouter-provider"
import type { AIModelProvider } from "@/runtime/types"
import { composeAssistantSystemPrompt } from "@/lib/assistant-request-prompt"
import {
  buildStage1SystemPrompt,
  buildStage1UserContent,
  captionExcerpt,
  decisionEventResponse,
  planAfterStage1,
  runStage1Classification,
} from "@/lib/assistant-stage1"
import { sealAssistantTextStream } from "@/lib/assistant-visible-stream"
import {
  AssistantSealConfigError,
  historyForModel,
  kindForCompletedTurn,
  readAssistantSealKey,
  signAssistantTurn,
  type AssistantTurnSeal,
  type HistoryTurn,
  type SpoilerMode,
} from "@/lib/assistant-turn-seal"
import { en } from "@/lib/locale/en"
import { readRequestLocale } from "@/lib/locale/read-request-locale"
import { zhCN } from "@/lib/locale/zh-CN"
import { escapeXmlAttr, escapeXmlTextForPresentation } from "@/lib/scene-assistant-context"
import { InvariantViolationError } from "@/lib/production-story-oracle"
import { assertReadUpToStoryIndexLast, VisibilityInvariantViolation } from "@/lib/visibility-invariant"
import { createScriptedAssistantProvider, scriptedAssistantProviderEnabled } from "@/lib/assistant-test-provider"
import { SceneWorkMismatchError, retrieveVerifiedAssistantContext } from "@/services/retrieval"

export const maxDuration = 30

type SceneCtx = {
  tsid: string
  workTitle: string
  title: string
  chapter_number: number
  chapter_title: string | null
  location: string
  characters: string[]
  summary: string
  characterTsids: string[]
}

type UserProgressBody = {
  workTsid: string
  readUpToChapter: number
  readUpToOrderIndex: number
  sceneTsid: string
  readUpToStoryIndexLast: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object"
}

function parseSpoilerMode(value: unknown): SpoilerMode | null {
  if (value == null) return "none"
  if (value === "none" || value === "single_request" || value === "conversation") return value
  return null
}

function parseSeal(value: unknown): AssistantTurnSeal | undefined {
  if (!isRecord(value)) return undefined
  const mode = value.spoilerMode
  const kind = value.kind
  if (
    typeof value.questionId !== "string" ||
    typeof value.workTsid !== "string" ||
    typeof value.sceneTsid !== "string" ||
    typeof value.contentSha256 !== "string" ||
    typeof value.signature !== "string" ||
    (mode !== "none" && mode !== "single_request" && mode !== "conversation") ||
    (kind !== "answer" &&
      kind !== "spoiler_answer" &&
      kind !== "authorization_request" &&
      kind !== "out_of_scope") ||
    typeof value.expandedRetrieval !== "boolean" ||
    typeof value.spoilerDisclosure !== "boolean" ||
    typeof value.spoilerAuthorizationRequest !== "boolean" ||
    typeof value.readUpToChapter !== "number" ||
    typeof value.readUpToOrderIndex !== "number" ||
    typeof value.readUpToStoryIndexLast !== "number"
  ) {
    return undefined
  }
  return {
    questionId: value.questionId,
    workTsid: value.workTsid,
    sceneTsid: value.sceneTsid,
    kind,
    spoilerMode: mode,
    expandedRetrieval: value.expandedRetrieval,
    spoilerDisclosure: value.spoilerDisclosure,
    spoilerAuthorizationRequest: value.spoilerAuthorizationRequest,
    readUpToChapter: value.readUpToChapter,
    readUpToOrderIndex: value.readUpToOrderIndex,
    readUpToStoryIndexLast: value.readUpToStoryIndexLast,
    contentSha256: value.contentSha256,
    signature: value.signature,
  }
}

function buildSummaryXml(summaries: { tsid: string; title: string; summary: string }[]): string {
  if (summaries.length === 0) return "<context></context>"
  const scenes = summaries.map((scene) => {
    const id = escapeXmlAttr(scene.tsid)
    const title = escapeXmlAttr(scene.title)
    return `  <scene id="${id}" title="${title}">${escapeXmlTextForPresentation(scene.summary.trim())}</scene>`
  })
  return `<context>\n${scenes.join("\n")}\n</context>`
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return new Response("Missing GEMINI_API_KEY in environment.", { status: 500 })
  }

  let sealKey: string
  try {
    sealKey = readAssistantSealKey()
  } catch (error) {
    if (error instanceof AssistantSealConfigError) {
      return new Response(error.message, { status: 500 })
    }
    throw error
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return new Response("Invalid JSON body", { status: 400 })
  }

  const rawMessages = body.messages
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return new Response("Missing messages", { status: 400 })
  }

  const history: HistoryTurn[] = []
  for (const message of rawMessages) {
    if (!isRecord(message)) return new Response("Invalid messages", { status: 400 })
    const role = message.role
    const content = message.content
    if (role !== "user" && role !== "assistant") return new Response("Invalid message role", { status: 400 })
    if (typeof content !== "string") return new Response("Invalid message content", { status: 400 })
    const questionId = typeof message.questionId === "string" ? message.questionId : undefined
    const seal = message.seal === undefined ? undefined : parseSeal(message.seal)
    history.push({ role, content, questionId, seal })
  }

  const last = history[history.length - 1]
  if (!last || last.role !== "user") return new Response("Last message must be from user", { status: 400 })
  const query = last.content.trim()
  if (!query) return new Response("Empty user message", { status: 400 })

  const spoilerMode = parseSpoilerMode(body.spoilerMode)
  if (!spoilerMode) return new Response("Invalid spoilerMode", { status: 400 })
  const authorizedQuestionId =
    typeof body.authorizedQuestionId === "string" ? body.authorizedQuestionId : ""
  if (spoilerMode === "single_request") {
    if (!last.questionId || authorizedQuestionId !== last.questionId) {
      return new Response("authorizedQuestionId does not match the question", { status: 400 })
    }
  }

  const questionId = last.questionId && last.questionId.trim() !== "" ? last.questionId : randomUUID()
  last.questionId = questionId

  const rawCtx = body.sceneContext
  if (!isRecord(rawCtx)) return new Response("Missing sceneContext", { status: 400 })
  const sceneTsidFromCtx = typeof rawCtx.tsid === "string" ? rawCtx.tsid.trim() : ""
  const sceneContext: SceneCtx = {
    tsid: sceneTsidFromCtx,
    workTitle: typeof rawCtx.workTitle === "string" ? rawCtx.workTitle.trim() : "",
    title: typeof rawCtx.title === "string" ? rawCtx.title : "",
    chapter_number: typeof rawCtx.chapter_number === "number" ? rawCtx.chapter_number : NaN,
    chapter_title:
      rawCtx.chapter_title === null ? null : typeof rawCtx.chapter_title === "string" ? rawCtx.chapter_title : null,
    location: typeof rawCtx.location === "string" ? rawCtx.location : "",
    characters: Array.isArray(rawCtx.characters)
      ? rawCtx.characters.filter((item): item is string => typeof item === "string")
      : [],
    summary: typeof rawCtx.summary === "string" ? rawCtx.summary : "",
    characterTsids: Array.isArray(rawCtx.characterTsids)
      ? rawCtx.characterTsids.filter((item): item is string => typeof item === "string" && !item.startsWith("cue:"))
      : [],
  }
  if (!sceneContext.tsid || !sceneContext.title || Number.isNaN(sceneContext.chapter_number)) {
    return new Response("Invalid sceneContext", { status: 400 })
  }

  const rawProgress = body.userProgress
  if (!isRecord(rawProgress)) return new Response("Missing userProgress", { status: 400 })
  const workTsid = typeof rawProgress.workTsid === "string" ? rawProgress.workTsid.trim() : ""
  const readUpToChapter = rawProgress.readUpToChapter
  const readUpToOrderIndex = rawProgress.readUpToOrderIndex
  const sceneTsid = typeof rawProgress.sceneTsid === "string" ? rawProgress.sceneTsid.trim() : ""
  const readUpToStoryIndexLast = rawProgress.readUpToStoryIndexLast
  if (
    !workTsid ||
    typeof readUpToChapter !== "number" ||
    !Number.isFinite(readUpToChapter) ||
    typeof readUpToOrderIndex !== "number" ||
    !Number.isFinite(readUpToOrderIndex) ||
    !sceneTsid
  ) {
    return new Response("Invalid userProgress", { status: 400 })
  }
  try {
    assertReadUpToStoryIndexLast(readUpToStoryIndexLast)
  } catch (error) {
    const message = error instanceof VisibilityInvariantViolation ? error.message : "Invalid userProgress"
    return new Response(message, { status: 400 })
  }
  if (sceneContext.tsid !== sceneTsid) {
    return new Response("sceneContext.tsid must match userProgress.sceneTsid", { status: 400 })
  }

  const userProgress: UserProgressBody = {
    workTsid,
    readUpToChapter,
    readUpToOrderIndex,
    sceneTsid,
    readUpToStoryIndexLast,
  }

  let verified: Awaited<ReturnType<typeof retrieveVerifiedAssistantContext>>
  try {
    verified = await retrieveVerifiedAssistantContext(query, userProgress, sceneContext.chapter_number, {
      spoilerMode,
      characterTsids: sceneContext.characterTsids,
    })
  } catch (error) {
    if (error instanceof SceneWorkMismatchError) {
      return new Response(error.message, { status: 400 })
    }
    if (error instanceof InvariantViolationError) {
      return new Response(JSON.stringify({ code: error.code, message: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
    const message = error instanceof Error ? error.message : "retrieveVerifiedAssistantContext failed"
    return new Response(message, { status: 502 })
  }

  console.log(
    `[RAG] requestId=${verified.requestId} CandidateSet: ${verified.observability.candidateSetSize} | Latency: ${Math.round(verified.observability.retrievalLatency)}ms | storyOracleBytes=${verified.storyOracle.byteSize}`
  )

  const expanded = spoilerMode !== "none"
  const locale = await readRequestLocale()
  const outOfScope = locale === "zh-CN" ? zhCN.assistantPrompt.outOfScope : en.assistantPrompt.outOfScope
  const system = await composeAssistantSystemPrompt(
    { ...sceneContext, summary: expanded ? verified.promptSummary : "" },
    verified.currentSceneRevealedXml,
    verified.chapterScenesXml,
    buildSummaryXml(verified.contextSummaries),
    {
      visibility: expanded ? "expanded" : "none",
      characterCards: verified.characterCards,
      omissionNote: verified.omissionNote,
    }
  )

  const modelMessages = historyForModel({
    messages: history,
    spoilerMode,
    workTsid,
    sceneTsid,
    progress: userProgress,
    sealKey,
  })

  const scripted = scriptedAssistantProviderEnabled()
  const provider = scripted ? createScriptedAssistantProvider() : createGeminiProvider({ apiKey })
  const fallbackProviders: AIModelProvider[] = []
  const openrouterApiKey = process.env.OPENROUTER_API_KEY
  if (!scripted && openrouterApiKey) fallbackProviders.push(createOpenRouterProvider({ apiKey: openrouterApiKey }))
  const fallback = fallbackProviders[0]

  if (!expanded) {
    if (req.signal.aborted) return new Response(null, { status: 499 })
    const visible = verified.chapterScenes.flatMap((scene) =>
      scene.revealedStorySlides.map((slide) => ({
        text: slide.caption,
        current: scene.tsid === sceneTsid,
      }))
    )
    const stage1 = await runStage1Classification({
      primary: provider,
      fallback,
      system: buildStage1SystemPrompt(),
      userContent: buildStage1UserContent({
        question: query,
        history: modelMessages.slice(0, -1),
        captions: visible.map((item) => item.text),
        workTitle: sceneContext.workTitle,
        sceneTitle: sceneContext.title,
      }),
      abortSignal: req.signal,
    })
    if (req.signal.aborted || (stage1.ok === false && stage1.aborted)) {
      return new Response(null, { status: 499 })
    }
    if (!stage1.ok) return new Response(stage1.message, { status: 502 })
    const plan = planAfterStage1(stage1.decision)
    if (plan === "authorization") {
      const excerpt = captionExcerpt(visible, query)
      const seal = signAssistantTurn(
        sealKey,
        {
          questionId,
          workTsid,
          sceneTsid,
          kind: "authorization_request",
          spoilerMode: "none",
          expandedRetrieval: false,
          spoilerDisclosure: false,
          spoilerAuthorizationRequest: true,
          readUpToChapter,
          readUpToOrderIndex,
          readUpToStoryIndexLast,
        },
        excerpt
      )
      return decisionEventResponse({ kind: "authorization", questionId, visibleText: excerpt, seal })
    }
    if (plan === "out_of_scope") {
      const seal = signAssistantTurn(
        sealKey,
        {
          questionId,
          workTsid,
          sceneTsid,
          kind: "out_of_scope",
          spoilerMode: "none",
          expandedRetrieval: false,
          spoilerDisclosure: false,
          spoilerAuthorizationRequest: false,
          readUpToChapter,
          readUpToOrderIndex,
          readUpToStoryIndexLast,
        },
        outOfScope
      )
      return decisionEventResponse({ kind: "out_of_scope", questionId, visibleText: outOfScope, seal })
    }
  }

  if (req.signal.aborted) return new Response(null, { status: 499 })

  const generated = await executeVerifiedGeneration({
    context: { requestId: verified.requestId, system, messages: modelMessages },
    primary: provider,
    fallbackProviders,
    abortSignal: req.signal,
  })

  return sealAssistantTextStream(generated, ({ prose }) => {
    const spoilerDisclosure = expanded
    return signAssistantTurn(
      sealKey,
      {
        questionId,
        workTsid,
        sceneTsid,
        kind: kindForCompletedTurn({
          content: prose,
          outOfScopeSentence: outOfScope,
          spoilerDisclosure,
          spoilerAuthorizationRequest: false,
        }),
        spoilerMode,
        expandedRetrieval: expanded,
        spoilerDisclosure,
        spoilerAuthorizationRequest: false,
        readUpToChapter,
        readUpToOrderIndex,
        readUpToStoryIndexLast,
      },
      prose
    )
  })
}
