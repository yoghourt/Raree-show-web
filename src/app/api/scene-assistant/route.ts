import { streamText, type ModelMessage } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { NextRequest } from "next/server"
import { getFetchForGoogleGenerativeAI } from "@/lib/gemini-proxy-fetch"
import { retrieveScenes, type RetrievedScene } from "@/services/retrieval"

export const maxDuration = 30

type ChatTurn = { role: "user" | "assistant"; content: string }

type SceneCtx = {
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
}

function formatRetrievedLine(scene: RetrievedScene): string {
  const title = typeof scene.title === "string" ? scene.title : ""
  const sim = scene.similarity
  const score =
    typeof sim === "number" && !Number.isNaN(sim) ? ` similarity=${sim.toFixed(4)}` : ""
  return `- ${scene.tsid}${title ? ` | ${title}` : ""}${score}`
}

function buildSystemPrompt(sceneContext: SceneCtx, ragBlock: string): string {
  const chapterLine =
    sceneContext.chapter_title != null && sceneContext.chapter_title !== ""
      ? `Chapter ${sceneContext.chapter_number} · ${sceneContext.chapter_title}`
      : `Chapter ${sceneContext.chapter_number}`

  return `You are a knowledgeable guide for "A Song of Ice and Fire".
Answer in maximum 2 sentences. Be concise and direct.

Current scene:
- Title: ${sceneContext.title}
- ${chapterLine}
- Location: ${sceneContext.location}
- Characters: ${sceneContext.characters.join(", ")}
- Summary: ${sceneContext.summary}

Retrieved context (background only; may be incomplete):
${ragBlock}`
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
  const sceneContext: SceneCtx = {
    title: typeof ctx.title === "string" ? ctx.title : "",
    chapter_number: typeof ctx.chapter_number === "number" ? ctx.chapter_number : NaN,
    chapter_title: ctx.chapter_title === null ? null : typeof ctx.chapter_title === "string" ? ctx.chapter_title : null,
    location: typeof ctx.location === "string" ? ctx.location : "",
    characters: Array.isArray(ctx.characters) ? ctx.characters.filter((c): c is string => typeof c === "string") : [],
    summary: typeof ctx.summary === "string" ? ctx.summary : "",
  }
  if (!sceneContext.title || Number.isNaN(sceneContext.chapter_number)) {
    return new Response("Invalid sceneContext", { status: 400 })
  }

  if (!rawProgress || typeof rawProgress !== "object") {
    return new Response("Missing userProgress", { status: 400 })
  }
  const p = rawProgress as Record<string, unknown>
  const workTsid = typeof p.workTsid === "string" ? p.workTsid.trim() : ""
  const readUpToChapter = p.readUpToChapter
  const readUpToOrderIndex = p.readUpToOrderIndex
  if (
    !workTsid ||
    typeof readUpToChapter !== "number" ||
    !Number.isFinite(readUpToChapter) ||
    typeof readUpToOrderIndex !== "number" ||
    !Number.isFinite(readUpToOrderIndex)
  ) {
    return new Response("Invalid userProgress", { status: 400 })
  }

  const userProgress: UserProgressBody = {
    workTsid,
    readUpToChapter,
    readUpToOrderIndex,
  }

  // Integrating ADR-002: Serial Pipeline with Metadata Pre-filtering
  let results: RetrievedScene[]
  let observability: { candidateSetSize: number; retrievalLatency: number }
  try {
    const out = await retrieveScenes(query, userProgress)
    results = out.results
    observability = out.observability
  } catch (e) {
    const msg = e instanceof Error ? e.message : "retrieveScenes failed"
    return new Response(msg, { status: 502 })
  }

  console.log(
    `[RAG] CandidateSet: ${observability.candidateSetSize} | Latency: ${Math.round(observability.retrievalLatency)}ms`
  )

  const ragBlock =
    results.length > 0
      ? results.map(formatRetrievedLine).join("\n")
      : "(No additional scenes retrieved beyond the current scene metadata.)"

  const system = buildSystemPrompt(sceneContext, ragBlock)

  const modelMessages: ModelMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const google = createGoogleGenerativeAI({
    apiKey,
    fetch: getFetchForGoogleGenerativeAI(),
  })

  try {
    const result = streamText({
      model: google("gemini-3-flash-preview"),
      system,
      messages: modelMessages,
      timeout: 60_000,
    })
    return result.toUIMessageStreamResponse()
  } catch (e) {
    const msg = e instanceof Error ? e.message : "streamText failed"
    return new Response(msg, { status: 502 })
  }
}
