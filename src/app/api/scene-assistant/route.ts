import { NextRequest } from "next/server"
import { createGeminiProvider, executeVerifiedGeneration } from "@/runtime"
import { createOpenRouterProvider } from "@/runtime/providers/openrouter-provider"
import type { AIModelProvider } from "@/runtime/types"
import { escapeXmlAttr, escapeXmlTextForPresentation } from "@/lib/scene-assistant-context"
import { buildAssistantSystemPrompt } from "@/lib/assistant-system-prompt"
import { messages } from "@/lib/locale"
import { InvariantViolationError } from "@/lib/production-story-oracle"
import { assertReadUpToStoryIndexLast, VisibilityInvariantViolation } from "@/lib/visibility-invariant"
import {
  retrieveVerifiedAssistantContext,
  type RetrievedScene,
} from "@/services/retrieval"

export const maxDuration = 30

type ChatTurn = { role: "user" | "assistant"; content: string }

type SceneCtx = {
  tsid: string
  workTitle: string
  title: string
  chapter_number: number
  chapter_title: string | null
  location: string
  characters: string[]
  summary: string
}

type UserProgressBody = {
  workTsid: string
  readUpToChapter: number
  readUpToOrderIndex: number
  sceneTsid: string
  readUpToStoryIndexLast: number
}

/** Narrative fields from match_scenes row only — no scores or internal ids in the model prompt. */
function sceneBodyFromRetrieved(scene: RetrievedScene): string {
  const summary = scene.summary
  if (typeof summary === "string" && summary.trim() !== "") {
    return escapeXmlTextForPresentation(summary.trim())
  }
  return escapeXmlTextForPresentation(messages.assistantPrompt.retrievalIdOnlyFallback)
}

function buildContextXml(results: RetrievedScene[]): string {
  if (results.length === 0) {
    return "<context></context>"
  }
  const scenes = results.map((scene) => {
    const id = escapeXmlAttr(scene.tsid)
    const titleRaw = typeof scene.title === "string" ? scene.title : ""
    const title = escapeXmlAttr(titleRaw)
    const body = sceneBodyFromRetrieved(scene)
    return `  <scene id="${id}" title="${title}">${body}</scene>`
  })
  return `<context>\n${scenes.join("\n")}\n</context>`
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return new Response("Missing GEMINI_API_KEY in environment.", { status: 500 })
  }

  let body: {
    messages?: unknown
    sceneContext?: unknown
    userProgress?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return new Response("Invalid JSON body", { status: 400 })
  }

  const { messages: rawMessages, sceneContext: rawCtx, userProgress: rawProgress } = body

  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return new Response("Missing messages", { status: 400 })
  }

  const messages: ChatTurn[] = []
  for (const m of rawMessages) {
    if (!m || typeof m !== "object") {
      return new Response("Invalid messages", { status: 400 })
    }
    const role = (m as { role?: unknown }).role
    const content = (m as { content?: unknown }).content
    if (role !== "user" && role !== "assistant") {
      return new Response("Invalid message role", { status: 400 })
    }
    if (typeof content !== "string") {
      return new Response("Invalid message content", { status: 400 })
    }
    messages.push({ role, content })
  }

  const last = messages[messages.length - 1]
  if (!last || last.role !== "user") {
    return new Response("Last message must be from user", { status: 400 })
  }
  const query = last.content.trim()
  if (!query) {
    return new Response("Empty user message", { status: 400 })
  }

  if (!rawCtx || typeof rawCtx !== "object") {
    return new Response("Missing sceneContext", { status: 400 })
  }
  const ctx = rawCtx as Record<string, unknown>
  const sceneTsidFromCtx = typeof ctx.tsid === "string" ? ctx.tsid.trim() : ""
  const sceneContext: SceneCtx = {
    tsid: sceneTsidFromCtx,
    workTitle: typeof ctx.workTitle === "string" ? ctx.workTitle.trim() : "",
    title: typeof ctx.title === "string" ? ctx.title : "",
    chapter_number: typeof ctx.chapter_number === "number" ? ctx.chapter_number : NaN,
    chapter_title: ctx.chapter_title === null ? null : typeof ctx.chapter_title === "string" ? ctx.chapter_title : null,
    location: typeof ctx.location === "string" ? ctx.location : "",
    characters: Array.isArray(ctx.characters) ? ctx.characters.filter((c): c is string => typeof c === "string") : [],
    summary: typeof ctx.summary === "string" ? ctx.summary : "",
  }
  if (!sceneContext.tsid || !sceneContext.title || Number.isNaN(sceneContext.chapter_number)) {
    return new Response("Invalid sceneContext", { status: 400 })
  }

  if (!rawProgress || typeof rawProgress !== "object") {
    return new Response("Missing userProgress", { status: 400 })
  }
  const p = rawProgress as Record<string, unknown>
  const workTsid = typeof p.workTsid === "string" ? p.workTsid.trim() : ""
  const readUpToChapter = p.readUpToChapter
  const readUpToOrderIndex = p.readUpToOrderIndex
  const sceneTsid = typeof p.sceneTsid === "string" ? p.sceneTsid.trim() : ""
  const readUpToStoryIndexLast = p.readUpToStoryIndexLast
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
  } catch (e) {
    const msg = e instanceof VisibilityInvariantViolation ? e.message : "Invalid userProgress"
    return new Response(msg, { status: 400 })
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
    verified = await retrieveVerifiedAssistantContext(
      query,
      userProgress,
      sceneContext.chapter_number
    )
  } catch (e) {
    if (e instanceof InvariantViolationError) {
      return new Response(
        JSON.stringify({ code: e.code, message: e.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }
    const msg = e instanceof Error ? e.message : "retrieveVerifiedAssistantContext failed"
    return new Response(msg, { status: 502 })
  }

  console.log(
    `[RAG] requestId=${verified.requestId} CandidateSet: ${verified.observability.candidateSetSize} | Latency: ${Math.round(verified.observability.retrievalLatency)}ms | storyOracleBytes=${verified.storyOracle.byteSize}`
  )

  const contextXml = buildContextXml(verified.results)

  const system = buildAssistantSystemPrompt(
    sceneContext,
    verified.currentSceneRevealedXml,
    verified.chapterScenesXml,
    contextXml
  )

  const provider = createGeminiProvider({ apiKey })

  // ADR-003 Phase 2: wire OpenRouter as deterministic pre-lock fallback.
  // OPENROUTER_API_KEY is optional; absent key disables fallback silently.
  const fallbackProviders: AIModelProvider[] = []
  const openrouterApiKey = process.env.OPENROUTER_API_KEY
  if (openrouterApiKey) {
    fallbackProviders.push(createOpenRouterProvider({ apiKey: openrouterApiKey }))
  }

  return executeVerifiedGeneration({
    context: {
      requestId: verified.requestId,
      system,
      messages,
    },
    primary: provider,
    fallbackProviders,
  })
}
