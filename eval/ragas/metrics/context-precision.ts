import type { RareeSingleTurnSample } from "../types"

/** Context precision authority: deterministic reference-context containment. */
export function computeContextPrecision(sample: RareeSingleTurnSample): number {
  const { contexts, reference_contexts } = sample
  if (contexts.length === 0) return 0

  const refSet = new Set(reference_contexts)
  let relevant = 0
  for (const chunk of contexts) {
    if (refSet.has(chunk)) relevant++
  }
  return relevant / contexts.length
}
