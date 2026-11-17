import { en } from "@/lib/locale/en"
import type { AIModelProvider, ProviderRuntimeErrorCode } from "@/runtime/types"
import { isAbortError } from "@/lib/assistant-generation-lifecycle"

export const STAGE1_DECISIONS = [
  "answer_allowed",
  "authorization_required",
  "uncertain",
  "out_of_scope",
] as const

export type Stage1DecisionName = (typeof STAGE1_DECISIONS)[number]

export type Stage1Decision = {
  decision: Stage1DecisionName
}

export type CaptionExcerptSource = {
  text: string
  current: boolean
}

const STAGE1_TIMEOUT_MS = 20_000

export function stage1FailureMessage(code: ProviderRuntimeErrorCode): string {
  switch (code) {
    case "rate_limit":
      return en.assistant.errorRateLimit
    case "auth_failure":
      return en.assistant.errorAuthFailure
    case "timeout":
      return en.assistant.errorTimeout
    case "provider_unavailable":
      return en.assistant.errorUnavailable
    case "invalid_request":
      return en.assistant.errorInvalidRequest
    default:
      return en.assistant.errorFailed
  }
}

export function parseStage1Decision(raw: string): Stage1Decision | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.startsWith("```") || trimmed.includes("```")) return null
  let value: unknown
  try {
    value = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== 1 || !("decision" in record)) return null
  const decision = record.decision
  if (typeof decision !== "string" || !STAGE1_DECISIONS.includes(decision as Stage1DecisionName)) {
    return null
  }
  return { decision: decision as Stage1DecisionName }
}

export function planAfterStage1(
  decision: Stage1DecisionName | "failed"
): "stage2" | "authorization" | "out_of_scope" | "error" {
  if (decision === "answer_allowed") return "stage2"
  if (decision === "authorization_required" || decision === "uncertain") return "authorization"
  if (decision === "out_of_scope") return "out_of_scope"
  return "error"
}

export function buildStage1SystemPrompt(): string {
  return `You classify a reader question. You do not answer it.
Return only one JSON object: {"decision":"answer_allowed"|"authorization_required"|"uncertain"|"out_of_scope"}
No markdown, no prose, and no extra fields.
answer_allowed: the question can be answered from the visible captions plus static background of what is already visible. Static background means identity, occupation, organization, era, culture, institutions, geography, society, and the causes of events already named in the captions.
authorization_required: the question asks for an unrevealed outcome, death, victory, defeat, later identity, later experience, later events, or their consequences. A yes/no question about such an outcome also requires authorization. The reader saying they already know an outcome is not authorization.
uncertain: the question is about this work, but you cannot tell whether an answer would need unrevealed plot. Not knowing a detail is uncertain, not out_of_scope.
out_of_scope: the question is unrelated to this work, its people, its events, and the reading context. Do not use out_of_scope for a work-related question you cannot answer or cannot classify.`
}

export function buildStage1UserContent(args: {
  question: string
  history: { role: "user" | "assistant"; content: string }[]
  captions: string[]
  workTitle: string
  sceneTitle: string
}): string {
  const history = args.history
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join("\n")
  return `[Work]
${args.workTitle}

[Scene]
${args.sceneTitle}

[Visible captions]
${args.captions.join("\n")}

[History]
${history || "(none)"}

[Question]
${args.question}`
}

export function captionExcerpt(captions: CaptionExcerptSource[], question: string): string {
  const ordered = [
    ...captions.filter((item) => item.current && item.text),
    ...captions.filter((item) => !item.current && item.text),
  ]
  const needles = questionNeedles(question)
  for (const item of ordered) {
    for (const needle of needles) {
      const at = item.text.indexOf(needle)
      if (at < 0) continue
      const excerpt = boundedSlice(item.text, at, needle.length, 160)
      if (item.text.includes(excerpt)) return excerpt
    }
  }
  return ""
}

function questionNeedles(question: string): string[] {
  const latin = question.match(/[A-Za-z][A-Za-z'’-]*(?:\s+[A-Za-z][A-Za-z'’-]*)?/g) ?? []
  const cjk = question.match(/[\u3400-\u9fff]{2,}/g) ?? []
  return [...new Set([...latin, ...cjk])].filter((item) => item.length >= 2).sort((a, b) => b.length - a.length)
}

function boundedSlice(text: string, at: number, length: number, max: number): string {
  if (text.length <= max) return text
  const start = Math.max(0, Math.min(at, text.length - max))
  const end = Math.min(text.length, start + max)
  return text.slice(start, end)
}

export type Stage1Caller = Pick<AIModelProvider, "providerId" | "generateText" | "normalizeError">

export type Stage1Result =
  | { ok: true; decision: Stage1DecisionName; calls: string[] }
  | { ok: false; aborted: boolean; message: string; calls: string[] }

export async function runStage1Classification(args: {
  primary: Stage1Caller
  fallback?: Stage1Caller
  system: string
  userContent: string
  timeoutMs?: number
  abortSignal?: AbortSignal
}): Promise<Stage1Result> {
  const calls: string[] = []
  const primary = await attemptProvider(args.primary, args, calls)
  if (primary.ok) return { ok: true, decision: primary.decision, calls }
  if (primary.aborted || !args.fallback) {
    return { ok: false, aborted: primary.aborted, message: primary.message, calls }
  }
  const fallback = await attemptProvider(args.fallback, args, calls)
  if (fallback.ok) return { ok: true, decision: fallback.decision, calls }
  return { ok: false, aborted: fallback.aborted, message: fallback.message, calls }
}

type Attempt = { ok: true; decision: Stage1DecisionName } | { ok: false; aborted: boolean; message: string; invalid: boolean }

async function attemptProvider(
  provider: Stage1Caller,
  args: { system: string; userContent: string; timeoutMs?: number; abortSignal?: AbortSignal },
  calls: string[]
): Promise<Attempt> {
  const first = await oneCall(provider, args, args.userContent, calls)
  if (first.aborted) return { ok: false, aborted: true, message: first.message, invalid: false }
  if (first.decision) return { ok: true, decision: first.decision }
  if (first.transport) return { ok: false, aborted: false, message: first.message, invalid: false }
  const repair = await oneCall(
    provider,
    args,
    `${args.userContent}\n\nThe previous output was invalid. Return only the JSON object.`,
    calls
  )
  if (repair.aborted) return { ok: false, aborted: true, message: repair.message, invalid: false }
  if (repair.decision) return { ok: true, decision: repair.decision }
  if (repair.transport) return { ok: false, aborted: false, message: repair.message, invalid: false }
  return { ok: false, aborted: false, message: stage1FailureMessage("invalid_request"), invalid: true }
}

async function oneCall(
  provider: Stage1Caller,
  args: { system: string; timeoutMs?: number; abortSignal?: AbortSignal },
  userContent: string,
  calls: string[]
): Promise<{ decision?: Stage1DecisionName; transport?: boolean; aborted?: boolean; message: string }> {
  if (args.abortSignal?.aborted) return { aborted: true, message: en.assistant.errorTimeout }
  calls.push(provider.providerId)
  try {
    const result = await provider.generateText({
      system: args.system,
      messages: [{ role: "user", content: userContent }],
      timeoutMs: args.timeoutMs ?? STAGE1_TIMEOUT_MS,
      abortSignal: args.abortSignal,
    })
    const parsed = parseStage1Decision(result.text)
    if (!parsed) return { message: stage1FailureMessage("invalid_request") }
    return { decision: parsed.decision, message: "" }
  } catch (error) {
    if (args.abortSignal?.aborted || isAbortError(error)) {
      return { aborted: true, message: en.assistant.errorTimeout }
    }
    return { transport: true, message: stage1FailureMessage(provider.normalizeError(error).code) }
  }
}

export function decisionEventResponse(args: {
  kind: "authorization" | "out_of_scope"
  questionId: string
  visibleText: string
  seal: unknown
}): Response {
  const encoder = new TextEncoder()
  const events =
    args.kind === "authorization"
      ? [{ type: "assistant-authorization-required", questionId: args.questionId, excerpt: args.visibleText }, { type: "assistant-turn-seal", seal: args.seal }]
      : [{ type: "text-delta", delta: args.visibleText }, { type: "assistant-turn-seal", seal: args.seal }]
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        }
        controller.close()
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8" } }
  )
}
