/**
 * ADR-003 Phase 2 fallback smoke test.
 *
 * Verifies the Phase 2-specific contribution: orchestrateProviderStream detects
 * SSE `error` events in the pre-lock buffer phase and throws so the coordinator
 * can activate OpenRouter fallback — even though streamText() returned successfully
 * and toUIMessageStreamResponse() already created an HTTP 200 Response.
 *
 * This is the scenario the Phase 1 architecture could NOT handle:
 *   streamText() OK → HTTP 200 created → SSE error event in body → (old) client sees error
 *                                                                 → (new) orchestrator intercepts, throws, fallback fires
 *
 * Run: npx tsx scripts/test-stream-fallback.ts
 * Env: OPENROUTER_API_KEY required in .env.local
 */

import path from "path"
import { config } from "dotenv"
config({ path: path.resolve(process.cwd(), ".env.local") })

import { executeVerifiedGeneration } from "../src/runtime/fallback-coordinator"
import { createOpenRouterProvider } from "../src/runtime/providers/openrouter-provider"
import type { AIModelProvider, ProviderRuntimeError, TextStreamHandle } from "../src/runtime/types"

// ---------------------------------------------------------------------------
// Assertion helper
// ---------------------------------------------------------------------------
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`\n[FAIL] ${msg}`)
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Mock primary provider — Phase 2 scenario:
//   streamText() succeeds (no throw)
//   toUIMessageStreamResponse() returns HTTP 200
//   but the body only contains an SSE error event (no text-delta ever arrives)
//
// This simulates the real Gemini behavior: quota exhaustion surfaces as a
// SSE error chunk *during stream consumption*, not as a rejected promise.
// The Phase 1 try/catch could not catch this; Phase 2 orchestrator can.
// ---------------------------------------------------------------------------
function makeSseErrorProvider(errorText: string): AIModelProvider {
  return {
    providerId: "mock-sse-error-gemini",

    async generateText() {
      throw new Error("not used in stream test")
    },

    async streamText(): Promise<TextStreamHandle> {
      // streamText() returns successfully — transport appears established.
      const errorSse = `data: ${JSON.stringify({ type: "error", errorText })}\n\n`
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          // Emit one SSE error event, then close — no text-delta ever arrives.
          controller.enqueue(new TextEncoder().encode(errorSse))
          controller.close()
        },
      })
      return {
        // HTTP 200 created — this is what Phase 1 would have returned directly to client.
        toUIMessageStreamResponse: () =>
          new Response(body, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
      }
    },

    normalizeError(error: unknown): ProviderRuntimeError {
      const msg = error instanceof Error ? error.message : String(error)
      if (/quota|resource.?exhausted|rate.?limit/i.test(msg)) {
        return { code: "rate_limit", message: msg }
      }
      return { code: "unknown", message: msg }
    },
  }
}

// ---------------------------------------------------------------------------
// Run tests
// ---------------------------------------------------------------------------
async function run(): Promise<void> {
  const openrouterApiKey = process.env.OPENROUTER_API_KEY
  assert(openrouterApiKey, "OPENROUTER_API_KEY must be set in .env.local")

  // ---- Test A: SSE error before semantic lock → fallback must fire --------
  console.log("\n[TEST A] SSE error event in pre-lock buffer → expect [FALLBACK] + OpenRouter success")
  console.log("         (streamText() returned 200 — Phase 1 would have passed this directly to client)\n")

  const sseBrokenPrimary = makeSseErrorProvider("RESOURCE_EXHAUSTED: quota exceeded")
  const fallback = createOpenRouterProvider({ apiKey: openrouterApiKey })

  const responseA = await executeVerifiedGeneration({
    context: {
      requestId: "smoke-test-sse-error",
      system: "You are a helpful assistant. Answer in one short sentence.",
      messages: [{ role: "user", content: "Say hello." }],
    },
    primary: sseBrokenPrimary,
    fallbackProviders: [fallback],
  })

  console.log(`\n[TEST A] Response status: ${responseA.status}`)
  assert(responseA.status === 200, `Expected 200, got ${responseA.status}`)

  const readerA = responseA.body!.getReader()
  const decoder = new TextDecoder()
  let chunksA = 0
  let rawA = ""
  while (true) {
    const { done, value } = await readerA.read()
    if (done) break
    chunksA++
    rawA += decoder.decode(value, { stream: true })
  }

  console.log(`[TEST A] Stream consumed: ${chunksA} chunk(s)`)
  assert(chunksA > 0, "Expected at least one streamed chunk from OpenRouter fallback")
  assert(rawA.includes("text-delta"), "Expected text-delta event from OpenRouter fallback stream")
  console.log("[TEST A] PASS ✓")

  // ---- Test B: text-delta arrives → lock fires, stream completes normally --
  console.log("\n[TEST B] text-delta before any error → expect [SEMANTIC_LOCK] + no fallback\n")

  const successPrimary: AIModelProvider = {
    providerId: "mock-success-gemini",
    async generateText() { throw new Error("not used") },
    async streamText(): Promise<TextStreamHandle> {
      const chunks = [
        `data: ${JSON.stringify({ type: "text-delta", delta: "Hello" })}\n\n`,
        `data: ${JSON.stringify({ type: "text-delta", delta: " world" })}\n\n`,
        `data: [DONE]\n\n`,
      ]
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const c of chunks) controller.enqueue(new TextEncoder().encode(c))
          controller.close()
        },
      })
      return { toUIMessageStreamResponse: () => new Response(body, { status: 200 }) }
    },
    normalizeError(): ProviderRuntimeError { return { code: "unknown", message: "" } },
  }

  const responseB = await executeVerifiedGeneration({
    context: {
      requestId: "smoke-test-lock",
      system: "irrelevant",
      messages: [{ role: "user", content: "hi" }],
    },
    primary: successPrimary,
    fallbackProviders: [],
  })

  console.log(`\n[TEST B] Response status: ${responseB.status}`)
  assert(responseB.status === 200, `Expected 200, got ${responseB.status}`)

  let rawB = ""
  const readerB = responseB.body!.getReader()
  while (true) {
    const { done, value } = await readerB.read()
    if (done) break
    rawB += decoder.decode(value, { stream: true })
  }

  assert(rawB.includes("Hello"), "Expected buffered text-delta 'Hello' in client stream")
  assert(rawB.includes("world"), "Expected buffered text-delta 'world' in client stream")
  console.log("[TEST B] PASS ✓")

  console.log("\n[TEST SUITE] ALL PASS")
  console.log("[TEST SUITE] Check stderr above for [FALLBACK], [SEMANTIC_LOCK], [STREAM_OWNER] log lines.")
}

run().catch((e) => {
  console.error("\n[TEST] UNEXPECTED ERROR:", e)
  process.exit(1)
})
