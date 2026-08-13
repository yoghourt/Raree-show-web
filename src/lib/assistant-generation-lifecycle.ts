/**
 * Scene Assistant generation lifecycle helpers (ADR-013 Cooperative Cancellation).
 * UI phase is not evidence that backend generation stopped; abort still uses AbortController.
 */

export type AssistantGenerationPhase =
  | "idle"
  | "streaming"
  | "completed"
  | "cancelled"
  | "failed"

export type AssistantMessageStatus = "streaming" | "completed" | "cancelled" | "failed"

export type AssistantChatMessage = {
  role: "user" | "assistant"
  content: string
  generationId?: number
  status?: AssistantMessageStatus
}

export const GENERATION_ABORT_REASON = "cancelled"

export function abortGenerationController(controller: AbortController | null | undefined): void {
  if (!controller || controller.signal.aborted) return
  try {
    controller.abort(GENERATION_ABORT_REASON)
  } catch {
    // Next.js overlays abort-without-reason as unhandledRejection
  }
}

export function isAbortError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const rec = error as { name?: unknown; message?: unknown; type?: unknown }
  if (rec.name === "AbortError" || rec.type === "aborted") return true
  if (typeof rec.message !== "string") return false
  const message = rec.message.toLowerCase()
  return (
    message === "this operation was aborted" ||
    message === "the operation was aborted." ||
    message.includes("signal is aborted") ||
    message.includes("aborted without reason")
  )
}

export function shouldAcceptAssistantDelta(args: {
  phase: AssistantGenerationPhase
  activeGenerationId: number
  eventGenerationId: number
}): boolean {
  return (
    args.phase === "streaming" &&
    args.activeGenerationId === args.eventGenerationId &&
    args.eventGenerationId > 0
  )
}

export function applyAssistantDelta(
  messages: AssistantChatMessage[],
  generationId: number,
  accumulated: string
): AssistantChatMessage[] {
  const next = [...messages]
  const last = next[next.length - 1]
  if (last?.role !== "assistant" || last.generationId !== generationId) {
    return messages
  }
  next[next.length - 1] = {
    ...last,
    content: accumulated,
    status: "streaming",
    generationId,
  }
  return next
}

export function markAssistantTerminal(
  messages: AssistantChatMessage[],
  generationId: number,
  terminal: Exclude<AssistantMessageStatus, "streaming">,
  content: string
): AssistantChatMessage[] {
  const next = [...messages]
  const last = next[next.length - 1]
  if (last?.role !== "assistant" || last.generationId !== generationId) {
    return messages
  }
  if (terminal === "cancelled" || terminal === "failed") {
    if (content.trim() === "" && last.content.trim() === "") {
      next.pop()
      return next
    }
  }
  next[next.length - 1] = {
    ...last,
    content: content.length > 0 ? content : last.content,
    status: terminal,
    generationId,
  }
  return next
}

export function historyTurnsForRequest(messages: AssistantChatMessage[]): {
  role: "user" | "assistant"
  content: string
}[] {
  return messages
    .filter((m) => !(m.role === "assistant" && m.status === "streaming"))
    .map(({ role, content }) => ({ role, content }))
}
