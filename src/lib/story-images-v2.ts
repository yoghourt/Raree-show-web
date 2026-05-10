/**
 * Canonical parsing of `story_images_v2` for Scene Assistant + retrieval.
 * Must stay aligned with SceneExperience `storyImages` (non-empty url, order preserved).
 */

export type EffectiveStorySlide = {
  url: string
  caption: string
}

export function effectiveStorySlidesFromV2(raw: unknown): EffectiveStorySlide[] {
  if (!Array.isArray(raw)) return []
  const out: EffectiveStorySlide[] = []
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

/** Inclusive end index: slides[0..last] revealed. last < 0 => no slides revealed. */
export function sliceRevealedStorySlides(
  slides: EffectiveStorySlide[],
  readUpToStoryIndexLast: number
): EffectiveStorySlide[] {
  if (slides.length === 0) return []
  const clamped = Math.min(Math.max(readUpToStoryIndexLast, -1), slides.length - 1)
  if (clamped < 0) return []
  return slides.slice(0, clamped + 1)
}
