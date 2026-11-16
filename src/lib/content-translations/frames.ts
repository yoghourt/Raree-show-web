import { effectiveReadingFramesFromV2 } from "@/lib/reading-frames"

export type FrameProvenanceRef = {
  frameIndex?: unknown
  sourceReviewId?: unknown
}

function trimmedId(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/** Null when the scene provenance is not a positional bijection or the index is ambiguous. */
export function resolveFrameSourceReviewId(
  entries: FrameProvenanceRef[] | null | undefined,
  frameIndex: number
): string | null {
  if (!entries || !Number.isInteger(frameIndex) || frameIndex < 0) return null
  const seenIds = new Set<string>()
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    if (!entry || entry.frameIndex !== index) return null
    const id = trimmedId(entry.sourceReviewId)
    if (!id || seenIds.has(id)) return null
    seenIds.add(id)
  }
  const matches = entries.filter(
    (entry) => entry.frameIndex === frameIndex && trimmedId(entry.sourceReviewId)
  )
  if (matches.length !== 1) return null
  return trimmedId(matches[0]?.sourceReviewId)
}

/**
 * Ids aligned with effective reader frames. A non-bijection scene yields nulls,
 * so every caption on that scene stays canonical English.
 */
export function frameSourceReviewIdsForEffectiveFrames(
  storyImages: unknown,
  provenance: unknown
): Array<string | null> {
  const effective = effectiveReadingFramesFromV2(storyImages)
  const blanks = effective.map(() => null)
  const rawFrames = Array.isArray(storyImages) ? storyImages : []
  const entries = Array.isArray(provenance) ? (provenance as FrameProvenanceRef[]) : []
  if (resolveFrameSourceReviewId(entries, 0) === null && entries.length > 0) return blanks
  if (entries.length !== rawFrames.length) return blanks
  const ids: Array<string | null> = []
  for (let rawIndex = 0; rawIndex < rawFrames.length; rawIndex += 1) {
    const item = rawFrames[rawIndex]
    if (item === null || typeof item !== "object" || !("url" in (item as object))) continue
    const record = item as { url?: unknown; caption?: unknown }
    const url = typeof record.url === "string" ? record.url.trim() : ""
    const caption = typeof record.caption === "string" ? record.caption : ""
    if (url.length === 0 && caption.trim().length === 0) continue
    ids.push(resolveFrameSourceReviewId(entries, rawIndex))
  }
  return ids.length === effective.length ? ids : blanks
}
