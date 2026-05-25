/**
 * ADR-003 Phase 2 — Internal Stream Orchestration Boundary.
 *
 * Introduces semantic stream ownership between the provider transport and the
 * client-visible SSE response.  Before the first client-visible semantic token
 * (`text-delta`) the orchestrator buffers all provider chunks internally,
 * allowing deterministic pre-lock fallback on transport failures.  Once the
 * first text-delta is detected the semantic lock is set, all buffered chunks
 * are flushed to a new ReadableStream, and only then is the client-visible
 * Response created.
 *
 * State machine:
 *   BOOTSTRAP → WARMUP → LOCK_PENDING → LOCKED → STREAMING → COMPLETE
 *                                             └──────────────→ ERROR
 *
 * Invariants enforced here:
 *   A  semantic_stream_locked === true → provider ownership immutable
 *   B  fallback permitted only before first text-delta
 *   C  no provider switching after first text-delta
 *
 * @see docs/specs/adr-003-phase-2-fallback.md
 */

import {
  logSemanticLockAcquired,
  logStreamOwnerLocked,
} from "@/runtime/provider-observability"
import type { AIModelProvider, VerifiedGenerationContext } from "@/runtime/types"

// ---------------------------------------------------------------------------
// Internal SSE mini-parser (pre-lock only)
// ---------------------------------------------------------------------------

type SsePreLockEvent =
  | { kind: "text-delta" }
  | { kind: "error"; errorText: string }

type PreLockParserState = {
  lineBuffer: string
  eventDataLines: string[]
}

function createPreLockParser(): {
  state: PreLockParserState
  feed(chunk: Uint8Array): SsePreLockEvent | null
} {
  const state: PreLockParserState = { lineBuffer: "", eventDataLines: [] }

  function dispatchEvent(rawEventLines: string[]): SsePreLockEvent | null {
    const dataLines = rawEventLines
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())

    if (dataLines.length === 0) return null
    const payload = dataLines.join("\n")
    if (!payload || payload === "[DONE]") return null

    try {
      const json = JSON.parse(payload) as {
        type?: string
        delta?: string
        errorText?: string
      }
      if (json.type === "text-delta" && typeof json.delta === "string") {
        return { kind: "text-delta" }
      }
      if (json.type === "error" && typeof json.errorText === "string") {
        return { kind: "error", errorText: json.errorText }
      }
    } catch {
      // malformed chunk — ignore, pass through
    }
    return null
  }

  function feed(chunk: Uint8Array): SsePreLockEvent | null {
    const text = new TextDecoder().decode(chunk, { stream: true })
    state.lineBuffer += text
    const lines = state.lineBuffer.split("\n")
    state.lineBuffer = lines.pop() ?? ""

    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, "")
      if (line === "") {
        if (state.eventDataLines.length > 0) {
          const event = dispatchEvent(state.eventDataLines)
          state.eventDataLines = []
          if (event !== null) return event
        }
        continue
      }
      if (line.startsWith("data:")) {
        state.eventDataLines.push(line)
      }
    }
    return null
  }

  return { state, feed }
}

// ---------------------------------------------------------------------------
// Error classification helper: provider error code from errorText string
// ---------------------------------------------------------------------------

function isFallbackEligibleErrorText(errorText: string): boolean {
  const lower = errorText.toLowerCase()
  return /rate.?limit|429|quota|resource.?exhausted|unauthorized|invalid.?api.?key|401|403|permission|503|502|unavailable|overloaded/.test(
    lower
  )
}

// ---------------------------------------------------------------------------
// Orchestrated stream entry-point
// ---------------------------------------------------------------------------

/**
 * Orchestrates the provider stream with semantic lock detection.
 *
 * BOOTSTRAP: calls `provider.streamText()`.
 * WARMUP / LOCK_PENDING: reads provider SSE body internally, buffering all
 *   chunks.  Any SSE `error` event before semantic lock causes this function
 *   to throw so the coordinator can attempt the next provider.
 * LOCKED: first `text-delta` detected — emits observability logs, flushes
 *   buffered chunks + remaining stream into a new ReadableStream, and returns
 *   the client-visible Response.
 *
 * The returned Response is subsequently wrapped by the caller with
 * `wrapResponseWithSemanticStreamGuard` for continued downstream observation.
 *
 * @throws when a provider transport failure is detected before semantic lock.
 *   The caller (fallback-coordinator) catches this and tries the next provider.
 */
export async function orchestrateProviderStream(
  provider: AIModelProvider,
  context: VerifiedGenerationContext,
  timeoutMs: number
): Promise<Response> {
  // BOOTSTRAP — provider.streamText() initiates the provider handle.
  //
  // Runtime observation (EAR-2 addendum, 2026-05-25):
  //   AI SDK v6 is NOT always lazy for all failure modes.  Gemini quota
  //   exhaustion (429 / AI_RetryError) surfaces as a thrown exception HERE,
  //   before reader.read() is ever called.  The coordinator's outer try/catch
  //   handles this path; orchestrator pre-lock buffer is not reached.
  //
  //   Separately, HTTP 200 responses that carry SSE error events in their
  //   body are handled by the pre-lock SSE parser below (LOCK_PENDING phase).
  //   These are two distinct failure paths; both result in correct fallback.
  const handle = await provider.streamText({
    system: context.system,
    messages: context.messages,
    timeoutMs,
  })

  // WARMUP — creates the HTTP 200 SSE Response skeleton; transport not yet
  // verified.  We take ownership of the body reader immediately.
  const raw = handle.toUIMessageStreamResponse()
  const body = raw.body

  if (body == null) {
    // Degenerate case: empty body — treat as bootstrap failure.
    throw new Error("provider stream returned empty body")
  }

  const reader = body.getReader()
  const buffer: Uint8Array[] = []
  const parser = createPreLockParser()

  // LOCK_PENDING — read chunks internally; do NOT forward to client yet.
  let lockedProviderChunk: Uint8Array | null = null

  while (true) {
    let done: boolean
    let value: Uint8Array | undefined
    try {
      ;({ done, value } = await reader.read())
    } catch (readErr) {
      // Transport-level read failure before semantic lock → throw for fallback.
      const msg = readErr instanceof Error ? readErr.message : String(readErr)
      throw new Error(`provider transport failure before semantic lock: ${msg}`)
    }

    if (done) {
      // Stream ended without emitting a text-delta.
      // Could be an empty response or silent failure — throw for fallback.
      throw new Error("provider stream ended before first semantic token")
    }

    buffer.push(value!)
    const event = parser.feed(value!)

    if (event !== null) {
      if (event.kind === "error") {
        // Pre-lock SSE error event — eligible for fallback.
        // Cancel the reader to release the underlying connection.
        reader.cancel().catch(() => undefined)
        throw new Error(event.errorText)
      }

      if (event.kind === "text-delta") {
        // LOCK transition: the text-delta chunk is pushed into `buffer` above
        // and stays there until the client-visible ReadableStream is consumed.
        // The chunk is NOT yet client-visible at this point.
        lockedProviderChunk = value!
        break
      }
    }
  }

  // -------------------------------------------------------------------------
  // DETERMINISTIC ORDERING INVARIANT (ADR-003 §4 Invariant A/B/C)
  //
  //   semantic_stream_locked MUST be established BEFORE the first semantic
  //   token becomes client-visible.
  //
  // Proof of ordering in this function:
  //   1. `break` above exits the loop; the triggering chunk is already in
  //      `buffer` but has NOT been forwarded anywhere yet.
  //   2. logSemanticLockAcquired / logStreamOwnerLocked fire synchronously
  //      here — ownership is frozen at this exact point.
  //   3. A new ReadableStream is constructed below.  Its `start(controller)`
  //      callback is invoked only when the caller begins consuming the body
  //      (i.e., after this function returns and the coordinator/guard reads
  //      the Response body).
  //   4. The buffer flush — including the first text-delta chunk — therefore
  //      happens AFTER step 2.
  //
  // Consequence: no semantic token can reach the client before the lock is
  // frozen.  Mid-stream provider switching is physically impossible after this
  // point because `reader` is owned exclusively by the ReadableStream below.
  // -------------------------------------------------------------------------
  logSemanticLockAcquired(context.requestId)
  logStreamOwnerLocked(provider.providerId)

  // STREAMING — build the client-visible ReadableStream by flushing the
  // pre-lock buffer then continuing to pipe from the now-owned reader.
  // `bufferedChunks` includes the first text-delta chunk; it becomes
  // client-visible only when `start(controller)` executes (post-return).
  const bufferedChunks = buffer.slice()
  void lockedProviderChunk // already captured in buffer; variable retained for clarity

  const clientStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Flush pre-lock buffer first (includes the chunk that triggered the lock).
      for (const chunk of bufferedChunks) {
        controller.enqueue(chunk)
      }

      // STREAMING — continue piping from reader; ownership is now immutable.
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            controller.close()
            return
          }
          controller.enqueue(value)
        }
      } catch (e) {
        // Post-lock failure: no fallback per Invariant A/C.
        // Close with error so the client receives a stream termination.
        controller.error(e)
      }
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })

  // COMPLETE state is reached inside the ReadableStream when reader.done.
  return new Response(clientStream, {
    status: raw.status,
    statusText: raw.statusText,
    headers: raw.headers,
  })
}

export { isFallbackEligibleErrorText }
