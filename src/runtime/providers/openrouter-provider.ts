/**
 * ADR-003 Phase 2 — OpenRouter fallback provider adapter.
 *
 * Additive integration only; no provider normalization layer.
 * Implements the narrow `AIModelProvider` contract exclusively.
 *
 * @see docs/specs/adr-003-phase-2-fallback.md §9 OpenRouter Integration Scope
 * @see docs/specs/adr-003-implementation-plan.md §3 AIModelProvider Contract
 */

import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateText, streamText } from "ai"
import type {
  AIModelProvider,
  GenerateTextRequest,
  GenerateTextResult,
  ProviderRuntimeError,
  ProviderRuntimeErrorCode,
  StreamTextRequest,
  TextStreamHandle,
} from "@/runtime/types"

// Default model routed through OpenRouter.  Must be overridden via env or
// options for production tuning; this value is intentionally conservative.
// Override with OPENROUTER_MODEL_ID env var or options.modelId.
const DEFAULT_MODEL_ID =
  process.env.OPENROUTER_MODEL_ID ?? "openai/gpt-oss-120b:free"

export type CreateOpenRouterProviderOptions = {
  apiKey: string
  modelId?: string
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

export function mapOpenRouterRuntimeError(error: unknown): ProviderRuntimeError {
  const message = errorMessage(error)
  const status = errorStatusCode(error)
  const code =
    (status !== undefined ? classifyByStatus(status) : null) ??
    classifyByMessage(message) ??
    "unknown"
  return { code, message, cause: error }
}

export function createOpenRouterProvider(
  options: CreateOpenRouterProviderOptions
): AIModelProvider {
  const modelId = options.modelId ?? DEFAULT_MODEL_ID
  const client = createOpenRouter({ apiKey: options.apiKey })
  const model = client(modelId)

  return {
    providerId: "openrouter",

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
      return mapOpenRouterRuntimeError(error)
    },
  }
}
