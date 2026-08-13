/**
 * CANCEL-002 generation lifecycle helpers (no network).
 * Run: npx tsx scripts/test-assistant-generation-lifecycle.ts
 */
import {
  applyAssistantDelta,
  historyTurnsForRequest,
  isAbortError,
  markAssistantTerminal,
  shouldAcceptAssistantDelta,
  type AssistantChatMessage,
} from "../src/lib/assistant-generation-lifecycle"

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`[FAIL] ${msg}`)
    process.exit(1)
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function run(): void {
  assert(isAbortError({ name: "AbortError", message: "Aborted" }), "AbortError name")
  assert(isAbortError({ name: "AbortError" }), "AbortError name only")
  assert(isAbortError({ name: "AbortError", message: "signal is aborted without reason" }), "abort without reason")
  assert(isAbortError({ type: "aborted", message: "The operation was aborted." }), "node-fetch aborted type")
  assert(!isAbortError(new Error("Generation failed.")), "provider error is not abort")
  assert(!isAbortError({ name: "TypeError", message: "Failed to fetch" }), "network error is not abort")

  assert(
    shouldAcceptAssistantDelta({ phase: "streaming", activeGenerationId: 2, eventGenerationId: 2 }),
    "accept same generation while streaming"
  )
  assert(
    !shouldAcceptAssistantDelta({ phase: "cancelled", activeGenerationId: 2, eventGenerationId: 2 }),
    "reject delta after cancelled"
  )
  assert(
    !shouldAcceptAssistantDelta({ phase: "failed", activeGenerationId: 2, eventGenerationId: 2 }),
    "reject delta after failed"
  )
  assert(
    !shouldAcceptAssistantDelta({ phase: "completed", activeGenerationId: 2, eventGenerationId: 2 }),
    "reject delta after completed"
  )
  assert(
    !shouldAcceptAssistantDelta({ phase: "streaming", activeGenerationId: 3, eventGenerationId: 2 }),
    "reject stale generation id"
  )

  let messages: AssistantChatMessage[] = [
    { role: "user", content: "hi" },
    { role: "assistant", content: "", status: "streaming", generationId: 1 },
  ]
  messages = applyAssistantDelta(messages, 1, "Hello")
  messages = applyAssistantDelta(messages, 1, "Hello there")
  assertEqual(messages[1]?.content, "Hello there", "partial accumulates")
  assertEqual(messages[1]?.status, "streaming", "still streaming")

  const afterCancel = markAssistantTerminal(messages, 1, "cancelled", "Hello there")
  assertEqual(afterCancel[1]?.content, "Hello there", "partial retained on cancel")
  assertEqual(afterCancel[1]?.status, "cancelled", "terminal cancelled")

  const lateIgnored = shouldAcceptAssistantDelta({
    phase: "cancelled",
    activeGenerationId: 1,
    eventGenerationId: 1,
  })
  assert(!lateIgnored, "late delta after cancel ignored")

  const afterFail = markAssistantTerminal(
    [
      { role: "user", content: "hi" },
      { role: "assistant", content: "partial", status: "streaming", generationId: 2 },
    ],
    2,
    "failed",
    "partial"
  )
  assertEqual(afterFail[1]?.status, "failed", "failure stays failed")
  assertEqual(afterFail[1]?.content, "partial", "failed partial retained")

  const emptyCancel = markAssistantTerminal(
    [
      { role: "user", content: "hi" },
      { role: "assistant", content: "", status: "streaming", generationId: 3 },
    ],
    3,
    "cancelled",
    ""
  )
  assertEqual(emptyCancel.length, 1, "empty cancelled assistant bubble removed")
  assertEqual(emptyCancel[0]?.role, "user", "user turn kept")

  const history = historyTurnsForRequest([
    { role: "user", content: "q1" },
    { role: "assistant", content: "a1", status: "cancelled", generationId: 1 },
    { role: "user", content: "q2" },
    { role: "assistant", content: "", status: "streaming", generationId: 2 },
  ])
  assertEqual(history.length, 3, "streaming turn excluded from request history")
  assertEqual(history[1]?.content, "a1", "cancelled partial included in later request history")

  console.log("test-assistant-generation-lifecycle: ok")
}

run()
