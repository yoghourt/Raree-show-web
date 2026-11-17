import { createHash, createHmac, timingSafeEqual } from "node:crypto"

export const ASSISTANT_TURN_SEAL_ENV = "ASSISTANT_TURN_SEAL_KEY"
export const ASSISTANT_TURN_SEAL_VERSION = "rg2-seal-v1"
export const SPOILER_REQUEST_MARKER = "<<RAREE_SPOILER_REQUEST>>"

export type SpoilerMode = "none" | "single_request" | "conversation"

export type AssistantMessageKind =
  | "answer"
  | "spoiler_answer"
  | "authorization_request"
  | "out_of_scope"

export type AssistantProgressSnapshot = {
  sceneTsid: string
  readUpToChapter: number
  readUpToOrderIndex: number
  readUpToStoryIndexLast: number
}

export type AssistantTurnSeal = {
  questionId: string
  workTsid: string
  sceneTsid: string
  kind: AssistantMessageKind
  spoilerMode: SpoilerMode
  expandedRetrieval: boolean
  spoilerDisclosure: boolean
  spoilerAuthorizationRequest: boolean
  readUpToChapter: number
  readUpToOrderIndex: number
  readUpToStoryIndexLast: number
  contentSha256: string
  signature: string
}

export type HistoryTurn = {
  role: "user" | "assistant"
  content: string
  questionId?: string
  seal?: AssistantTurnSeal
}

export class AssistantSealConfigError extends Error {
  constructor() {
    super("Generation service configuration error.")
    this.name = "AssistantSealConfigError"
  }
}

export function readAssistantSealKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = env[ASSISTANT_TURN_SEAL_ENV]
  if (typeof key !== "string" || key.trim() === "") {
    throw new AssistantSealConfigError()
  }
  return key
}

export function hashAssistantContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex")
}

export function sealCanonical(seal: Omit<AssistantTurnSeal, "signature" | "contentSha256"> & { contentSha256: string }): string {
  return [
    ASSISTANT_TURN_SEAL_VERSION,
    "assistant",
    seal.questionId,
    seal.kind,
    seal.spoilerMode,
    seal.expandedRetrieval ? "1" : "0",
    seal.spoilerDisclosure ? "1" : "0",
    seal.spoilerAuthorizationRequest ? "1" : "0",
    String(seal.readUpToChapter),
    String(seal.readUpToOrderIndex),
    String(seal.readUpToStoryIndexLast),
    seal.workTsid,
    seal.sceneTsid,
    seal.contentSha256,
  ].join("\n")
}

export function signAssistantTurn(
  key: string,
  fields: Omit<AssistantTurnSeal, "signature" | "contentSha256">,
  content: string
): AssistantTurnSeal {
  const contentSha256 = hashAssistantContent(content)
  const signature = createHmac("sha256", key)
    .update(sealCanonical({ ...fields, contentSha256 }), "utf8")
    .digest("hex")
  return { ...fields, contentSha256, signature }
}

function signaturesMatch(actual: string, expected: string): boolean {
  const left = Buffer.from(actual)
  const right = Buffer.from(expected)
  if (left.length !== right.length) {
    timingSafeEqual(left, left)
    return false
  }
  return timingSafeEqual(left, right)
}

export function verifyAssistantTurn(key: string, content: string, seal: AssistantTurnSeal): boolean {
  if (seal.contentSha256 !== hashAssistantContent(content)) return false
  const expected = createHmac("sha256", key)
    .update(sealCanonical(seal), "utf8")
    .digest("hex")
  return signaturesMatch(seal.signature, expected)
}

export function kindForCompletedTurn(args: {
  content: string
  outOfScopeSentence: string
  spoilerDisclosure: boolean
  spoilerAuthorizationRequest: boolean
}): AssistantMessageKind {
  if (args.spoilerAuthorizationRequest) return "authorization_request"
  if (args.content.trim() === args.outOfScopeSentence) return "out_of_scope"
  if (args.spoilerDisclosure) return "spoiler_answer"
  return "answer"
}

export function splitSpoilerMarker(text: string): { prose: string; requested: boolean } {
  const trimmedEnd = text.replace(/\s+$/u, "")
  if (trimmedEnd === SPOILER_REQUEST_MARKER) return { prose: "", requested: true }
  const suffix = `\n${SPOILER_REQUEST_MARKER}`
  if (trimmedEnd.endsWith(suffix)) {
    return { prose: trimmedEnd.slice(0, -suffix.length).replace(/\s+$/u, ""), requested: true }
  }
  return { prose: text, requested: false }
}

const MARKER_HOLD = SPOILER_REQUEST_MARKER.length + 1

export class SpoilerMarkerTail {
  private text = ""
  private released = 0

  push(delta: string): string {
    this.text += delta
    const safeEnd = Math.max(0, this.text.length - MARKER_HOLD)
    const next = this.text.slice(this.released, safeEnd)
    this.released = safeEnd
    return next
  }

  finish(): { flush: string; prose: string; requested: boolean } {
    const split = splitSpoilerMarker(this.text)
    const flush = split.prose.slice(Math.min(this.released, split.prose.length))
    this.released = this.text.length
    return { flush, prose: split.prose, requested: split.requested }
  }

  abort(): string {
    let pending = this.text.slice(this.released)
    const marker = `\n${SPOILER_REQUEST_MARKER}`
    for (let size = Math.min(marker.length - 1, pending.length); size >= 1; size -= 1) {
      const suffix = pending.slice(-size)
      if (suffix.includes("<") && marker.startsWith(suffix)) {
        pending = pending.slice(0, -size)
        break
      }
    }
    return pending
  }
}

export function progressIsAhead(
  sealed: Pick<AssistantProgressSnapshot, "readUpToChapter" | "readUpToOrderIndex" | "readUpToStoryIndexLast">,
  current: Pick<AssistantProgressSnapshot, "readUpToChapter" | "readUpToOrderIndex" | "readUpToStoryIndexLast">
): boolean {
  if (sealed.readUpToChapter !== current.readUpToChapter) {
    return sealed.readUpToChapter > current.readUpToChapter
  }
  if (sealed.readUpToOrderIndex !== current.readUpToOrderIndex) {
    return sealed.readUpToOrderIndex > current.readUpToOrderIndex
  }
  return sealed.readUpToStoryIndexLast > current.readUpToStoryIndexLast
}

export function historyForModel(args: {
  messages: HistoryTurn[]
  spoilerMode: SpoilerMode
  workTsid: string
  sceneTsid: string
  progress: AssistantProgressSnapshot
  sealKey?: string
}): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = []
  for (const message of args.messages) {
    if (message.role === "user") {
      out.push({ role: "user", content: message.content })
      continue
    }
    if (!message.seal) continue
    if (args.sealKey && !verifyAssistantTurn(args.sealKey, message.content, message.seal)) continue
    const seal = message.seal
    if (seal.workTsid !== args.workTsid || seal.sceneTsid !== args.sceneTsid) continue
    if (args.spoilerMode === "none") {
      if (seal.spoilerDisclosure || seal.expandedRetrieval || seal.spoilerMode !== "none") continue
      if (
        progressIsAhead(seal, {
          readUpToChapter: args.progress.readUpToChapter,
          readUpToOrderIndex: args.progress.readUpToOrderIndex,
          readUpToStoryIndexLast: args.progress.readUpToStoryIndexLast,
        })
      ) {
        continue
      }
    }
    out.push({ role: "assistant", content: message.content })
  }
  return out
}

export function visibilityCeiling(mode: SpoilerMode): "progress" | "work" {
  return mode === "none" ? "progress" : "work"
}
