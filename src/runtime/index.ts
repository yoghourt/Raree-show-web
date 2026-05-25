export type {
  AIModelProvider,
  GenerateTextRequest,
  GenerateTextResult,
  GenerationMessage,
  ProviderFallbackMetadata,
  ProviderRuntimeError,
  ProviderRuntimeErrorCode,
  StreamTextRequest,
  TextStreamHandle,
  VerifiedGenerationContext,
} from "@/runtime/types"

export { executeVerifiedGeneration } from "@/runtime/fallback-coordinator"
export type { ExecuteGenerationOptions } from "@/runtime/fallback-coordinator"

export { createGeminiProvider, mapGeminiRuntimeError } from "@/runtime/providers/gemini-provider"
export type { CreateGeminiProviderOptions } from "@/runtime/providers/gemini-provider"

export {
  createOpenRouterProvider,
  mapOpenRouterRuntimeError,
} from "@/runtime/providers/openrouter-provider"
export type { CreateOpenRouterProviderOptions } from "@/runtime/providers/openrouter-provider"

export {
  buildProviderFallbackMetadata,
  logFallbackActivated,
  logProviderAttemptStart,
  logProviderExecutionFailure,
  logProviderFallbackMetadata,
  logSemanticLockAcquired,
  logSemanticStreamLocked,
  logStreamOwnerLocked,
} from "@/runtime/provider-observability"

export { wrapResponseWithSemanticStreamGuard } from "@/runtime/semantic-stream-guard"
export type { SemanticStreamGuardContext } from "@/runtime/semantic-stream-guard"

export { orchestrateProviderStream } from "@/runtime/stream-orchestrator"
