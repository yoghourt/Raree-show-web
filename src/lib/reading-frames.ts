/**
 * Canonical parsing of `story_images_v2` for Reading Route Assistant + retrieval.
 * Must stay aligned with ReadingRouteExperience `readingFrames` (order preserved).
 *
 * Presentable frames = non-empty `url` OR non-empty `caption` (text-first Discovery writes).
 * Never fall back to Reading Route `summary` for caption presentation
 * (see raree-show-admin docs/specs/story-structure-exit-criteria.md).
 *
 * Runtime Representation (ADR-004 / SPEC-CORE-001): Reading Frame persistence shape.
 * Runtime Reading capability (SPEC-RDX-001) consumes these frames as Reader Step backing —
 * this module does not redefine Reader Step or Frame Narrative policy.
 *
 * Owner: Implementation (Persistence / Representation helpers).
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
    const url =
      typeof (item as { url?: unknown }).url === "string"
        ? (item as { url: string }).url.trim()
        : ""
    const caption =
      typeof (item as { caption?: unknown }).caption === "string"
        ? (item as { caption: string }).caption
        : ""
    if (url.length > 0 || caption.trim().length > 0) {
      out.push({ url, caption })
    }
  }
  return out
}

/**
 * Caption for the current Reader Step index — aligned with ImageReel frames.
 * Never falls back to Reading Route `summary`.
 */
export function resolvePresentedCaption(
  raw: unknown,
  imageIndex: number
): string {
  const frames = effectiveReadingFramesFromV2(raw)
  if (frames.length === 0) return ""
  return frames[imageIndex]?.caption?.trim() ?? ""
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
