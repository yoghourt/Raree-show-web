/**
 * ADR-003 minimal generation runtime contract (inference + stream + error normalization only).
 * @see docs/specs/adr-003-implementation-plan.md
 */

export type ProviderRuntimeErrorCode =
  | "rate_limit"
  | "auth_failure"
  | "timeout"
  | "provider_unavailable"
  | "invalid_request"
  | "unknown"

export type ProviderRuntimeError = {
  code: ProviderRuntimeErrorCode
  message: string
  cause?: unknown
}

export interface ProviderFallbackMetadata {
  requestId: string
  primaryProvider: string
  fallbackProvider: string
  downgradeReason: ProviderRuntimeErrorCode
  downgradedAt: string
  originalErrorMessage?: string
}

export type GenerationMessage = {
  role: "user" | "assistant"
  content: string
}

export type GenerateTextRequest = {
  system: string
  messages: GenerationMessage[]
  timeoutMs?: number
}

export type StreamTextRequest = GenerateTextRequest

export type GenerateTextResult = { text: string }

/** Adapter returns AI SDK stream handle; coordinator owns HTTP + semantic guard. */
export type TextStreamHandle = {
  toUIMessageStreamResponse: () => Response
}

export interface AIModelProvider {
  readonly providerId: string
  generateText(request: GenerateTextRequest): Promise<GenerateTextResult>
  streamText(request: StreamTextRequest): Promise<TextStreamHandle>
  normalizeError(error: unknown): ProviderRuntimeError
}

/** Post-retrieval / post-oracle generation input — no retrieval fields. */
export type VerifiedGenerationContext = {
  requestId: string
  system: string
  messages: GenerationMessage[]
}
