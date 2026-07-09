/**
 * Canonical parsing of `story_images_v2` for Reading Route Assistant + retrieval.
 * Must stay aligned with ReadingRouteExperience `readingFrames` (non-empty url, order preserved).
 */

export type EffectiveReadingFrame = {
  url: string
  caption: string
}

export function effectiveReadingFramesFromV2(raw: unknown): EffectiveReadingFrame[] {
  if (!Array.isArray(raw)) return []
  const out: EffectiveReadingFrame[] = []
  for (const item of raw) {
    if (item === null || typeof item !== "object" || !("url" in item)) continue
    const url = typeof (item as { url?: unknown }).url === "string" ? (item as { url: string }).url.trim() : ""
    const caption =
      typeof (item as { caption?: unknown }).caption === "string" ? (item as { caption: string }).caption : ""
    if (url.length > 0) {
      out.push({ url, caption })
    }
  }
  return out
}

/** Inclusive end index: frames[0..last] revealed. last < 0 => no frames revealed. */
export function sliceRevealedReadingFrames(
  frames: EffectiveReadingFrame[],
  readUpToFrameIndexLast: number
): EffectiveReadingFrame[] {
  if (frames.length === 0) return []
  const clamped = Math.min(Math.max(readUpToFrameIndexLast, -1), frames.length - 1)
  if (clamped < 0) return []
  return frames.slice(0, clamped + 1)
}
