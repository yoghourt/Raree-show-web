import type {
  ProviderFallbackMetadata,
  ProviderRuntimeErrorCode,
} from "@/runtime/types"

const LOG_PREFIX = "[scene-assistant-runtime]"

// ---------------------------------------------------------------------------
// ADR-003 Phase 2 mandatory log formats
// @see docs/specs/adr-003-phase-2-fallback.md §10 Observability Contract
// ---------------------------------------------------------------------------

/**
 * Emits: [FALLBACK] Primary provider failed. Switched to OpenRouter. RequestId: ${requestId}
 */
export function logFallbackActivated(
  requestId: string,
  primaryProvider: string,
  fallbackProvider: string,
  reason: string
): void {
  const label = fallbackProvider === "openrouter" ? "OpenRouter" : fallbackProvider
  console.error(
    `[FALLBACK] Primary provider failed. Switched to ${label}. RequestId: ${requestId}`,
    JSON.stringify({ primaryProvider, fallbackProvider, reason })
  )
}

/**
 * Emits: [SEMANTIC_LOCK] Stream ownership locked. RequestId: ${requestId}
 */
export function logSemanticLockAcquired(requestId: string): void {
  console.error(`[SEMANTIC_LOCK] Stream ownership locked. RequestId: ${requestId}`)
}

/**
 * Emits: [STREAM_OWNER] Provider locked: gemini/openrouter
 */
export function logStreamOwnerLocked(providerId: string): void {
  console.error(`[STREAM_OWNER] Provider locked: ${providerId}`)
}

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
