import { streamText, type ModelMessage } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { NextRequest } from "next/server"
import { getFetchForGoogleGenerativeAI } from "@/lib/gemini-proxy-fetch"
import {
  fetchChapterScenesWithinProgress,
  retrieveScenes,
  type ChapterSceneSnippet,
  type RetrievedScene,
} from "@/services/retrieval"

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

function escapeXmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function escapeXmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** Narrative fields from match_scenes row only — no scores or internal ids in the model prompt. */
function sceneBodyFromRetrieved(scene: RetrievedScene): string {
  const summary = scene.summary
  if (typeof summary === "string" && summary.trim() !== "") {
    return escapeXmlText(summary.trim())
  }
  return escapeXmlText("（检索结果仅含场景标识与标题。）")
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

function buildChapterScenesXml(scenes: ChapterSceneSnippet[]): string {
  if (scenes.length === 0) {
    return "<chapterScenesInProgress></chapterScenesInProgress>"
  }
  const lines = scenes.map((s) => {
    const id = escapeXmlAttr(s.tsid)
    const title = escapeXmlAttr(s.title)
    const body =
      s.summary.trim() !== "" ? escapeXmlText(s.summary.trim()) : escapeXmlText("（无摘要）")
    return `  <scene id="${id}" title="${title}">${body}</scene>`
  })
  return `<chapterScenesInProgress>\n${lines.join("\n")}\n</chapterScenesInProgress>`
}

function buildSystemPrompt(
  sceneContext: SceneCtx,
  chapterScenesXml: string,
  contextXml: string
): string {
  const chapterLine =
    sceneContext.chapter_title != null && sceneContext.chapter_title !== ""
      ? `第 ${sceneContext.chapter_number} 章 · ${sceneContext.chapter_title}`
      : `第 ${sceneContext.chapter_number} 章`

  return `你是 Raree Show Scene Assistant（《冰与火之歌》沉浸式阅读助手）。

【硬性规则】
- 你唯一可引用的材料是：(1) 下方「当前阅读场景」；(2) 「本章已读场景序列」XML（同章内、按 order_index 至当前进度，含多场景摘要）；(3) 紧接着的 <context> 检索补充片段。不得使用预训练知识补充、猜测或预告任何在上述材料中未明确出现的情节；不得放宽阅读进度边界或假定读者已读后续内容。
- 用户若问「本章」「这一章」内的人事、顺序或退场/离场，必须优先综合「本章已读场景序列」里各 <scene> 的摘要（按文档顺序串联）作答；若仅凭这些材料、且限于已读进度内已写出的事件，就足以回答，你必须据实作答，不得用拒答句敷衍。
- 仅当同时满足：(1) 上述全部材料中仍无可引用依据，或 (2) 完整作答必然依赖预训练知识或进度之外的后续剧情时，你必须且只能回答（原句，不得增删）：根据目前的进度，该信息尚未揭晓。
- 语气：冷静、庄重、有史诗叙事感，与维斯特洛的肃杀与命运感相称；不要扮演“全书通”或剧透者。
- 回答最多两句，简洁。

【引用】
- 凡依据检索场景作答时，必须在答复中点名该场景的标题（与 <context> 中 title 一致）。
- 依据「本章已读场景序列」中某一场景作答时，须点名该场景标题。
- 仅依据「当前阅读场景」小节作答时，须点名当前场景标题（可用书名号《${sceneContext.title}》表述）。

【当前阅读场景】
- 标题：${sceneContext.title}
- ${chapterLine}
- 地点：${sceneContext.location}
- 人物：${sceneContext.characters.join("、")}
- 摘要：${sceneContext.summary}

【本章已读场景序列】（至当前阅读进度；用于「本章」类问题）
${chapterScenesXml}

以下为阅读进度内语义检索到的补充场景（XML，根节点为 <context>；若为空则根节点内无子节点）：
${contextXml}`
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
  let chapterScenes: ChapterSceneSnippet[]
  try {
    const [out, ch] = await Promise.all([
      retrieveScenes(query, userProgress),
      fetchChapterScenesWithinProgress(userProgress, sceneContext.chapter_number),
    ])
    results = out.results
    observability = out.observability
    chapterScenes = ch
  } catch (e) {
    const msg = e instanceof Error ? e.message : "retrieveScenes failed"
    return new Response(msg, { status: 502 })
  }

  console.log(
    `[RAG] CandidateSet: ${observability.candidateSetSize} | Latency: ${Math.round(observability.retrievalLatency)}ms`
  )

  const chapterScenesXml = buildChapterScenesXml(chapterScenes)
  const contextXml = buildContextXml(results)

  const system = buildSystemPrompt(sceneContext, chapterScenesXml, contextXml)

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
