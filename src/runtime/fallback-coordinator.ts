import {
  buildProviderFallbackMetadata,
  logProviderAttemptStart,
  logProviderExecutionFailure,
  logProviderFallbackMetadata,
} from "@/runtime/provider-observability"
import { wrapResponseWithSemanticStreamGuard } from "@/runtime/semantic-stream-guard"
import type { AIModelProvider, ProviderRuntimeError, VerifiedGenerationContext } from "@/runtime/types"

const DEFAULT_STREAM_TIMEOUT_MS = 60_000

export type ExecuteGenerationOptions = {
  context: VerifiedGenerationContext
  primary: AIModelProvider
  /** Phase 1: empty — wiring for Phase 2 OpenRouter failover only. */
  fallbackProviders?: AIModelProvider[]
}

function clientSafeMessage(normalized: ProviderRuntimeError): string {
  switch (normalized.code) {
    case "rate_limit":
      return "Generation temporarily unavailable (rate limit)."
    case "auth_failure":
      return "Generation service configuration error."
    case "timeout":
      return "Generation timed out."
    case "provider_unavailable":
      return "Generation service temporarily unavailable."
    case "invalid_request":
      return "Invalid generation request."
    default:
      return "Generation failed."
  }
}

function errorResponse(normalized: ProviderRuntimeError, status = 502): Response {
  return new Response(clientSafeMessage(normalized), { status })
}

async function attemptStream(
  provider: AIModelProvider,
  context: VerifiedGenerationContext,
  attemptIndex: number
): Promise<Response> {
  logProviderAttemptStart({
    requestId: context.requestId,
    providerId: provider.providerId,
    attemptIndex,
  })

  const handle = await provider.streamText({
    system: context.system,
    messages: context.messages,
    timeoutMs: DEFAULT_STREAM_TIMEOUT_MS,
  })

  const raw = handle.toUIMessageStreamResponse()
  return wrapResponseWithSemanticStreamGuard(raw, {
    requestId: context.requestId,
    providerId: provider.providerId,
  })
}

/**
 * Generation orchestration for verified Scene Assistant context.
 * MUST NOT call retrieval or oracle — receives post-RAG context only.
 */
export async function executeVerifiedGeneration(
  options: ExecuteGenerationOptions
): Promise<Response> {
  const { context, primary, fallbackProviders = [] } = options
  const providers: AIModelProvider[] = [primary, ...fallbackProviders]

  let lastNormalized: ProviderRuntimeError | null = null

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i]!
    try {
      return await attemptStream(provider, context, i)
    } catch (e) {
      const normalized = provider.normalizeError(e)
      lastNormalized = normalized

      logProviderExecutionFailure({
        requestId: context.requestId,
        providerId: provider.providerId,
        code: normalized.code,
        message: normalized.message,
        attemptIndex: i,
      })

      const next = providers[i + 1]
      if (next) {
        logProviderFallbackMetadata(
          buildProviderFallbackMetadata({
            requestId: context.requestId,
            primaryProvider: primary.providerId,
            fallbackProvider: next.providerId,
            downgradeReason: normalized.code,
            originalErrorMessage: normalized.message,
          })
        )
        continue
      }
    }
  }

  return errorResponse(
    lastNormalized ?? {
      code: "unknown",
      message: "Generation failed with no provider result.",
    }
  )
}
