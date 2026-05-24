/**
 * ADR-003 streaming safety: provider fallback may occur ONLY before the first
 * semantic `text-delta` is forwarded to the client. After emission starts, fail closed
 * and preserve request lineage in logs — never attempt mid-stream provider switching.
 *
 * @see docs/adr/003-multi-provider-ai-runtime.md
 */

import { logProviderExecutionFailure, logSemanticStreamLocked } from "@/runtime/provider-observability"

export type SemanticStreamGuardContext = {
  requestId: string
  providerId: string
}

function parseUiMessageSseEvent(rawEvent: string): {
  isTextDelta?: boolean
  isError?: boolean
  errorText?: string
} {
  const dataLines = rawEvent
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())

  if (dataLines.length === 0) return {}

  const payload = dataLines.join("\n")
  if (!payload || payload === "[DONE]") return {}

  try {
    const json = JSON.parse(payload) as {
      type?: string
      delta?: string
      errorText?: string
    }
    if (json.type === "error" && typeof json.errorText === "string") {
      return { isError: true, errorText: json.errorText }
    }
    if (json.type === "text-delta" && typeof json.delta === "string") {
      return { isTextDelta: true }
    }
  } catch {
    // ignore malformed chunks — pass-through unchanged
  }
  return {}
}

function encodeSseErrorEvent(message: string): Uint8Array {
  const payload = JSON.stringify({ type: "error", errorText: message })
  return new TextEncoder().encode(`data: ${payload}\n\n`)
}

type SseParserState = {
  lineBuffer: string
  eventDataLines: string[]
  semanticStreamStarted: boolean
  lockedLogged: boolean
}

function inspectSseEvent(
  state: SseParserState,
  ctx: SemanticStreamGuardContext,
  rawEvent: string
): void {
  const parsed = parseUiMessageSseEvent(rawEvent)

  if (parsed.isTextDelta && !state.semanticStreamStarted) {
    state.semanticStreamStarted = true
    if (!state.lockedLogged) {
      state.lockedLogged = true
      logSemanticStreamLocked({
        requestId: ctx.requestId,
        providerId: ctx.providerId,
      })
    }
  }

  if (parsed.isError) {
    logProviderExecutionFailure({
      requestId: ctx.requestId,
      providerId: ctx.providerId,
      code: state.semanticStreamStarted ? "unknown" : "provider_unavailable",
      message: parsed.errorText ?? "stream error event",
    })
  }
}

function feedSseParser(
  state: SseParserState,
  ctx: SemanticStreamGuardContext,
  text: string
): void {
  state.lineBuffer += text
  const lines = state.lineBuffer.split("\n")
  state.lineBuffer = lines.pop() ?? ""

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "")
    if (line === "") {
      if (state.eventDataLines.length > 0) {
        inspectSseEvent(state, ctx, state.eventDataLines.join("\n"))
        state.eventDataLines = []
      }
      continue
    }
    if (line.startsWith("data:")) {
      state.eventDataLines.push(line)
    }
  }
}

function flushSseParser(state: SseParserState, ctx: SemanticStreamGuardContext): void {
  if (state.lineBuffer.length > 0) {
    feedSseParser(state, ctx, "\n")
  }
  if (state.eventDataLines.length > 0) {
    inspectSseEvent(state, ctx, state.eventDataLines.join("\n"))
    state.eventDataLines = []
  }
}

/**
 * Wraps a UI message stream response so coordinator can enforce the semantic emission boundary.
 */
export function wrapResponseWithSemanticStreamGuard(
  response: Response,
  ctx: SemanticStreamGuardContext
): Response {
  const body = response.body
  if (body == null) {
    return response
  }

  const parserState: SseParserState = {
    lineBuffer: "",
    eventDataLines: [],
    semanticStreamStarted: false,
    lockedLogged: false,
  }

  const guardedBody = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            flushSseParser(parserState, ctx)
            controller.close()
            return
          }
          controller.enqueue(value)
          feedSseParser(parserState, ctx, new TextDecoder().decode(value, { stream: true }))
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "stream read failed"
        logProviderExecutionFailure({
          requestId: ctx.requestId,
          providerId: ctx.providerId,
          code: "unknown",
          message,
        })
        if (parserState.semanticStreamStarted) {
          controller.enqueue(encodeSseErrorEvent(message))
        }
        controller.close()
      }
    },
    cancel(reason) {
      return body.cancel(reason)
    },
  })

  return new Response(guardedBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}
