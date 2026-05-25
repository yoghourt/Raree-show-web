import { NextRequest } from "next/server"
import { createGeminiProvider, executeVerifiedGeneration } from "@/runtime"
import { createOpenRouterProvider } from "@/runtime/providers/openrouter-provider"
import type { AIModelProvider } from "@/runtime/types"
import { escapeXmlAttr, escapeXmlTextForPresentation } from "@/lib/scene-assistant-context"
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
  return escapeXmlTextForPresentation("（检索结果仅含场景标识与标题。）")
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

function buildSystemPrompt(
  sceneContext: SceneCtx,
  currentSceneRevealedXml: string,
  chapterScenesXml: string,
  contextXml: string
): string {
  const chapterLine =
    sceneContext.chapter_title != null && sceneContext.chapter_title !== ""
      ? `第 ${sceneContext.chapter_number} 章 · ${sceneContext.chapter_title}`
      : `第 ${sceneContext.chapter_number} 章`

  const workLine =
    sceneContext.workTitle.trim() !== ""
      ? sceneContext.workTitle.trim()
      : "（作品标题未提供，仅以 Raree 注入材料为准）"

  return `你是 Raree Show Scene Assistant（多作品沉浸式阅读助手）。
**当前作品（Raree）：** ${workLine}
所有剧情边界以本提示中 Raree 注入的已揭示材料为准；**不要**默认读者正在阅读某一特定名著，除非与上述作品名或注入文本明显一致。

【边界说明（勿向用户复述）】
- 语义检索拓扑不变：候选场景仍由阅读进度 SQL 门限定；下文 Raree 文本中的 story 已按阅读进度在服务端物理截断，未出现的 caption 即未揭示。
- 进入本提示的文本不含向量相似度等排序元数据。

【已揭示叙事】
下列块为读者已揭示内容：(1) 当前阅读场景元数据与「当前场景已揭示 story」；(2) 同章 **same-chapter revealed-scene context**（仅 prompt 拼装用只读库表，非第二套语义检索）；(3) \`<context>\` 内语义检索补充（已排除当前场景 tsid，避免整场景 RAG 文本越过 story 截断）。
- **已揭示范围内**：可结合预训练知识做**润色**（文风、衔接），仅补充与**当前作品叙事相容**、且不越过已揭示进度的公开设定；不得与 Raree 文本矛盾，冲突以 Raree 为准。
- **当场实体的识别信息**：若问题指向**当前已读情节里已出场**的人物、生物或物件（如当屏出现的一组动物或道具），询问**名字、数量、外观、与在场角色的对应**等，caption 未写全时**仍允许**用预训练按**与当前作品一致的源作常识**补全**名称与对应关系**（仅限已读进度内已知者）；**必须作答**，**禁止**用固定拒答句。
- 若问题仅涉及 **已读 story 所覆盖叙事时段内** 的事件（含本章人物**死亡、遇害、离场顺序或时点**）：caption 已写明则据 caption；caption 略简时可用预训练作**仅限该已读范围内**的复述与润色（不得写到未读 story 之后）；**必须作答**，**禁止**用固定拒答句敷衍。
- **合理推断**：允许基于已读 caption 做读者层面的**合理推断**（如致命袭击、非人异象、扼控等描写可推出伤亡或濒死，**不要求** caption 出现「死」等直述）。推断所依据的事实必须来自已注入的 XML 文本；不引入未读情节即属已揭示区，**必须作答**。
- **「何时死亡」类问题**：以**叙事内顺序与场次**回答即可（如「于当前已读片段中」「先于/后于某描写」），不必编造文本未写的钟表时刻。
- **多人提问**：若问多人而材料仅支持其中一部分，**逐人**说明能由已读+合理推断得出的结论；对仍缺依据的角色可答「据已读片段尚难断定」。**禁止**因「未能一次答满所有人」而对整题使用固定拒答。
- 使用 Raree caption/story 时须点名对应**场景标题**（与 XML 中 title 或当前场景标题一致）。

【未揭示叙事 — Closed-domain】
固定拒答**不适用于**：仅凭 caption 字面较简，但答案属于**同一段已读叙事内的识别或当场事实**（含命名、当场可见关系）——此类须按上条用预训练在已读范围内补全。
仅当 **同时满足**：(1) 已揭示材料、合理推断与**当场实体补全规则**仍无法给出任何实质答案，且 (2) 完整回答**必然**依赖未读 story、未展示 caption、或**未读进度之后**的叙事/时间线（如角色**未来**命运、尚未展示的秘密）时：禁止用预训练补全后续；你必须且只能回答（原句，不得增删）：根据目前的进度，该信息尚未揭晓。

【语气】冷静、庄重、有史诗感，贴合当前作品的叙事尺度。回答最多两句。

【当前阅读场景】
- 作品：${workLine}
- tsid：${sceneContext.tsid}
- 标题：${sceneContext.title}
- ${chapterLine}
- 地点：${sceneContext.location}
- 人物：${sceneContext.characters.join("、")}
- 摘要（次要，可能为空）：${sceneContext.summary}

【当前场景已揭示 story（物理截断后）】
${currentSceneRevealedXml}

【同章已揭示场景上下文（same-chapter revealed-scene context）】
${chapterScenesXml}

【语义检索补充（\`<context>\`）】
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

  const system = buildSystemPrompt(
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
