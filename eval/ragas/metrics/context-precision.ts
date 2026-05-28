import type { RareeSingleTurnSample } from "../types"

/** Context precision: proportion of retrieved captions found in canonical reference_captions. */
export function computeContextPrecision(sample: RareeSingleTurnSample): number {
  const { captions, reference_captions } = sample
  if (captions.length === 0) return 0

  const refSet = new Set(reference_captions)
  let relevant = 0
  for (const caption of captions) {
    if (refSet.has(caption)) relevant++
  }
  return relevant / captions.length
}
