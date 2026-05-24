/**
 * Asserts Gemini runtime error normalization (no network).
 * Run: npx tsx scripts/test-provider-normalize-error.ts
 */
import { mapGeminiRuntimeError } from "../src/runtime/providers/gemini-provider"

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`)
  }
}

function run(): void {
  assertEqual(mapGeminiRuntimeError({ statusCode: 429, message: "Too Many Requests" }).code, "rate_limit", "429")
  assertEqual(
    mapGeminiRuntimeError(new Error("RESOURCE_EXHAUSTED: quota exceeded")).code,
    "rate_limit",
    "quota message"
  )
  assertEqual(mapGeminiRuntimeError({ status: 401, message: "Unauthorized" }).code, "auth_failure", "401")
  assertEqual(mapGeminiRuntimeError(new Error("Request timed out")).code, "timeout", "timeout")
  assertEqual(mapGeminiRuntimeError({ statusCode: 503, message: "unavailable" }).code, "provider_unavailable", "503")
  assertEqual(mapGeminiRuntimeError({ statusCode: 400, message: "bad" }).code, "invalid_request", "400")
  assertEqual(mapGeminiRuntimeError(new Error("something odd")).code, "unknown", "unknown")

  console.log("test-provider-normalize-error: ok")
}

run()
