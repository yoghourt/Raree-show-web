/**
 * Development-only stand-in for the scene-assistant model providers.
 * Inactive unless NODE_ENV is not production and ASSISTANT_TEST_PROVIDER=scripted.
 * The script file is read on each call so a test can change the next response
 * without restarting the server. This is not a production model.
 */
import { readFileSync, writeFileSync } from "node:fs"
import type { AIModelProvider, GenerateTextResult, ProviderRuntimeError, TextStreamHandle } from "@/runtime/types"

export function scriptedAssistantProviderEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ASSISTANT_TEST_PROVIDER === "scripted"
}

type Script = {
  delayMs?: number
  texts: string[]
  stream: "delta" | "error" | "partial-hang"
}

function scriptPath(): string {
  const configured = process.env.ASSISTANT_TEST_SCRIPT_PATH
  if (!configured) throw new Error("ASSISTANT_TEST_SCRIPT_PATH is required for the scripted provider")
  return configured
}

function readScript(): Script {
  const parsed = JSON.parse(readFileSync(scriptPath(), "utf8")) as Script
  return {
    delayMs: parsed.delayMs ?? 0,
    texts: Array.isArray(parsed.texts) ? parsed.texts : [],
    stream: parsed.stream ?? "delta",
  }
}

function writeScript(script: Script) {
  writeFileSync(scriptPath(), JSON.stringify(script))
}

function delay(ms: number) {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createScriptedAssistantProvider(): AIModelProvider {
  return {
    providerId: "scripted",
    async generateText(): Promise<GenerateTextResult> {
      const script = readScript()
      await delay(script.delayMs ?? 0)
      const text = script.texts.shift()
      writeScript(script)
      if (text === undefined) throw new Error("scripted provider has no text")
      console.log("[assistant-test-provider] generateText")
      return { text }
    },
    async streamText(): Promise<TextStreamHandle> {
      const script = readScript()
      await delay(script.delayMs ?? 0)
      console.log(`[assistant-test-provider] stream ${script.stream}`)
      const encoder = new TextEncoder()
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          if (script.stream === "error") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", errorText: "scripted stage 2 failure" })}\n\n`))
            controller.close()
            return
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-delta", delta: "scripted answer" })}\n\n`))
          if (script.stream === "partial-hang") return
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish" })}\n\n`))
          controller.close()
        },
      })
      return {
        toUIMessageStreamResponse: () => new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
      }
    },
    normalizeError(error: unknown): ProviderRuntimeError {
      const message = error instanceof Error ? error.message : "scripted failure"
      return { code: "provider_unavailable", message }
    },
  }
}
