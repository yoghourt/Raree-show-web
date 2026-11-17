import { SpoilerMarkerTail, type AssistantTurnSeal } from "@/lib/assistant-turn-seal"

type ParsedSse = { type?: string; delta?: string; errorText?: string }

function parseEvent(raw: string): ParsedSse | null {
  const data = raw
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n")
  if (!data || data === "[DONE]") return { type: data === "[DONE]" ? "done" : undefined }
  try {
    return JSON.parse(data) as ParsedSse
  } catch {
    return null
  }
}

function encodeEvent(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

export type AssistantSealFactory = (args: {
  prose: string
  spoilerAuthorizationRequest: boolean
}) => AssistantTurnSeal

/**
 * Strips a trailing spoiler marker from UI-message text deltas and appends one
 * seal event after a clean completion. Errors and aborts do not emit a seal.
 */
export function sealAssistantTextStream(response: Response, createSeal: AssistantSealFactory): Response {
  const body = response.body
  if (body == null || !response.ok) return response

  const reader = body.getReader()
  const decoder = new TextDecoder()
  const tail = new SpoilerMarkerTail()
  let lineBuffer = ""
  let eventLines: string[] = []
  let failed = false
  let sealed = false

  const emit = (controller: ReadableStreamDefaultController<Uint8Array>, payload: unknown) => {
    controller.enqueue(encodeEvent(payload))
  }

  const finishClean = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (sealed || failed) return
    sealed = true
    const done = tail.finish()
    if (done.flush) emit(controller, { type: "text-delta", delta: done.flush })
    emit(controller, {
      type: "assistant-turn-seal",
      seal: createSeal({ prose: done.prose, spoilerAuthorizationRequest: done.requested }),
    })
  }

  const fail = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (failed) return
    failed = true
    const rest = tail.abort()
    if (rest) emit(controller, { type: "text-delta", delta: rest })
  }

  const handleEvent = (controller: ReadableStreamDefaultController<Uint8Array>, raw: string) => {
    const parsed = parseEvent(raw)
    if (!parsed) {
      controller.enqueue(new TextEncoder().encode(`${raw}\n\n`))
      return
    }
    if (parsed.type === "text-delta" && typeof parsed.delta === "string") {
      const safe = tail.push(parsed.delta)
      if (safe) emit(controller, { type: "text-delta", delta: safe })
      return
    }
    if (parsed.type === "error") {
      fail(controller)
      emit(controller, parsed)
      return
    }
    if (parsed.type === "done" || parsed.type === "finish" || parsed.type === "finish-step") {
      finishClean(controller)
      if (parsed.type !== "done") emit(controller, parsed)
      return
    }
    emit(controller, parsed)
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            const trailing = decoder.decode()
            if (trailing) lineBuffer += trailing
            if (lineBuffer.trim()) eventLines.push(lineBuffer)
            if (eventLines.length > 0) handleEvent(controller, eventLines.join("\n"))
            if (!failed && !sealed) finishClean(controller)
            controller.close()
            return
          }
          lineBuffer += decoder.decode(value, { stream: true })
          const lines = lineBuffer.split("\n")
          lineBuffer = lines.pop() ?? ""
          for (const rawLine of lines) {
            const line = rawLine.replace(/\r$/, "")
            if (line === "") {
              if (eventLines.length > 0) {
                handleEvent(controller, eventLines.join("\n"))
                eventLines = []
              }
              continue
            }
            if (line.startsWith("data:")) eventLines.push(line)
          }
        }
      } catch {
        fail(controller)
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })

  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}
