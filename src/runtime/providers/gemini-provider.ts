import { generateText, streamText } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { getFetchForGoogleGenerativeAI } from "@/lib/gemini-proxy-fetch"
import type {
  AIModelProvider,
  GenerateTextRequest,
  GenerateTextResult,
  ProviderRuntimeError,
  ProviderRuntimeErrorCode,
  StreamTextRequest,
  TextStreamHandle,
} from "@/runtime/types"

const DEFAULT_MODEL_ID = "gemini-3-flash-preview"

export type CreateGeminiProviderOptions = {
  apiKey: string
  modelId?: string
  fetch?: typeof fetch
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function errorStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined
  const rec = error as Record<string, unknown>
  if (typeof rec.statusCode === "number") return rec.statusCode
  if (typeof rec.status === "number") return rec.status
  return undefined
}

function classifyByStatus(status: number): ProviderRuntimeErrorCode | null {
  if (status === 401 || status === 403) return "auth_failure"
  if (status === 408 || status === 504) return "timeout"
  if (status === 429) return "rate_limit"
  if (status === 400 || status === 422) return "invalid_request"
  if (status === 502 || status === 503 || status === 529) return "provider_unavailable"
  return null
}

function classifyByMessage(message: string): ProviderRuntimeErrorCode | null {
  const lower = message.toLowerCase()
  if (/rate.?limit|429|quota|resource.?exhausted/.test(lower)) return "rate_limit"
  if (/unauthorized|invalid.?api.?key|401|403|permission/.test(lower)) return "auth_failure"
  if (/timeout|timed out|deadline|abort/.test(lower)) return "timeout"
  if (/503|502|unavailable|overloaded|internal error/.test(lower)) return "provider_unavailable"
  if (/invalid.?request|400|bad request|malformed/.test(lower)) return "invalid_request"
  return null
}

export function mapGeminiRuntimeError(error: unknown): ProviderRuntimeError {
  const message = errorMessage(error)
  const status = errorStatusCode(error)
  const code =
    (status !== undefined ? classifyByStatus(status) : null) ??
    classifyByMessage(message) ??
    "unknown"
  return { code, message, cause: error }
}

export function createGeminiProvider(options: CreateGeminiProviderOptions): AIModelProvider {
  const modelId = options.modelId ?? DEFAULT_MODEL_ID
  const fetchImpl = options.fetch ?? getFetchForGoogleGenerativeAI()
  const google = createGoogleGenerativeAI({
    apiKey: options.apiKey,
    fetch: fetchImpl,
  })
  const model = google(modelId)

  return {
    providerId: "gemini",

    async generateText(request: GenerateTextRequest): Promise<GenerateTextResult> {
      const { text } = await generateText({
        model,
        system: request.system,
        messages: request.messages,
        ...(request.timeoutMs !== undefined ? { timeout: request.timeoutMs } : {}),
      })
      return { text }
    },

    async streamText(request: StreamTextRequest): Promise<TextStreamHandle> {
      const result = streamText({
        model,
        system: request.system,
        messages: request.messages,
        timeout: request.timeoutMs ?? 60_000,
      })
      return {
        toUIMessageStreamResponse: () => result.toUIMessageStreamResponse(),
      }
    },

    normalizeError(error: unknown): ProviderRuntimeError {
      return mapGeminiRuntimeError(error)
    },
  }
}
