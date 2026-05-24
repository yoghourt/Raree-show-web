import type {
  ProviderFallbackMetadata,
  ProviderRuntimeErrorCode,
} from "@/runtime/types"

const LOG_PREFIX = "[scene-assistant-runtime]"

type ProviderAttemptStartFields = {
  requestId: string
  providerId: string
  attemptIndex: number
}

type ProviderExecutionFailureFields = {
  requestId: string
  providerId: string
  code: ProviderRuntimeErrorCode
  message: string
  attemptIndex?: number
}

type SemanticStreamLockedFields = {
  requestId: string
  providerId: string
}

function emit(event: string, fields: Record<string, unknown>): void {
  console.error(`${LOG_PREFIX} ${JSON.stringify({ event, ...fields })}`)
}

export function logProviderAttemptStart(fields: ProviderAttemptStartFields): void {
  emit("provider_attempt_start", fields)
}

export function logProviderExecutionFailure(fields: ProviderExecutionFailureFields): void {
  emit("provider_attempt_failure", fields)
}

export function logSemanticStreamLocked(fields: SemanticStreamLockedFields): void {
  emit("semantic_stream_locked", fields)
}

export function buildProviderFallbackMetadata(params: {
  requestId: string
  primaryProvider: string
  fallbackProvider: string
  downgradeReason: ProviderRuntimeErrorCode
  originalErrorMessage?: string
  downgradedAt?: string
}): ProviderFallbackMetadata {
  return {
    requestId: params.requestId,
    primaryProvider: params.primaryProvider,
    fallbackProvider: params.fallbackProvider,
    downgradeReason: params.downgradeReason,
    downgradedAt: params.downgradedAt ?? new Date().toISOString(),
    ...(params.originalErrorMessage !== undefined
      ? { originalErrorMessage: params.originalErrorMessage }
      : {}),
  }
}

/** Structured downgrade event (Phase 2+); skeleton ready before OpenRouter exists. */
export function logProviderFallbackMetadata(meta: ProviderFallbackMetadata): void {
  emit("provider_fallback", meta as unknown as Record<string, unknown>)
}
