import type { ChapterSceneSnippet } from "@/services/retrieval"

export function escapeXmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

export function escapeXmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

const EMPTY_REVEALED_PLACEHOLDER = "（无已揭示 story）"
const EMPTY_CAPTION_PLACEHOLDER = "（无 caption）"

export function emptyRevealedStoryPlaceholderText(): string {
  return escapeXmlText(EMPTY_REVEALED_PLACEHOLDER)
}

export function escapedStoryCaptionText(caption: string): string {
  return caption.trim() !== ""
    ? escapeXmlText(caption.trim())
    : escapeXmlText(EMPTY_CAPTION_PLACEHOLDER)
}

export function storyPayloadBytesFromSlides(slides: { caption: string }[]): number {
  if (slides.length === 0) {
    return Buffer.byteLength(emptyRevealedStoryPlaceholderText(), "utf8")
  }
  let sum = 0
  for (const sl of slides) {
    sum += Buffer.byteLength(escapedStoryCaptionText(sl.caption), "utf8")
  }
  return sum
}

export function buildChapterScenesXml(scenes: ChapterSceneSnippet[]): string {
  if (scenes.length === 0) {
    return "<chapterScenesInProgress></chapterScenesInProgress>"
  }
  const lines = scenes.map((s) => {
    const id = escapeXmlAttr(s.tsid)
    const title = escapeXmlAttr(s.title)
    if (s.revealedStorySlides.length === 0) {
      return `  <scene id="${id}" title="${title}">\n    <story index="0">${emptyRevealedStoryPlaceholderText()}</story>\n  </scene>`
    }
    const storyLines = s.revealedStorySlides
      .map((sl, idx) => {
        const cap = escapedStoryCaptionText(sl.caption)
        return `    <story index="${idx}">${cap}</story>`
      })
      .join("\n")
    return `  <scene id="${id}" title="${title}">\n${storyLines}\n  </scene>`
  })
  return `<chapterScenesInProgress>\n${lines.join("\n")}\n</chapterScenesInProgress>`
}

export function buildCurrentSceneRevealedXml(slides: { caption: string }[]): string {
  if (slides.length === 0) {
    return `<currentSceneRevealedStories>\n  <story index="0">${emptyRevealedStoryPlaceholderText()}</story>\n</currentSceneRevealedStories>`
  }
  const inner = slides
    .map((sl, idx) => {
      const cap = escapedStoryCaptionText(sl.caption)
      return `  <story index="${idx}">${cap}</story>`
    })
    .join("\n")
  return `<currentSceneRevealedStories>\n${inner}\n</currentSceneRevealedStories>`
}

/** Σ(authorized_story_content) aligned with model-visible story XML payloads. */
export function measureRetrievedStoryContextBytes(
  chapterScenes: ChapterSceneSnippet[],
  sceneTsid: string
): number {
  const current = chapterScenes.find((s) => s.tsid === sceneTsid)
  let sum = storyPayloadBytesFromSlides(current?.revealedStorySlides ?? [])
  for (const s of chapterScenes) {
    sum += storyPayloadBytesFromSlides(s.revealedStorySlides)
  }
  return sum
}
