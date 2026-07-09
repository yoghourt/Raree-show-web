import type { ChapterSceneSnippet } from "@/services/retrieval"
import { messages } from "@/lib/locale"

const EMPTY_REVEALED_PLACEHOLDER = messages.assistantPrompt.emptyRevealedStory
const EMPTY_CAPTION_PLACEHOLDER = messages.assistantPrompt.emptyCaption

export function escapeXmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/** Presentation layer only — not part of production semantic oracle. */
export function escapeXmlTextForPresentation(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** @deprecated Use escapeXmlTextForPresentation */
export function escapeXmlText(s: string): string {
  return escapeXmlTextForPresentation(s)
}

export function emptyRevealedStoryPlaceholderText(): string {
  return escapeXmlTextForPresentation(EMPTY_REVEALED_PLACEHOLDER)
}

/** Presentation: raw caption escaped without trim; empty caption → fixed placeholder. */
export function presentationStoryCaptionText(caption: string): string {
  return caption.length > 0
    ? escapeXmlTextForPresentation(caption)
    : escapeXmlTextForPresentation(EMPTY_CAPTION_PLACEHOLDER)
}

/** @deprecated Use presentationStoryCaptionText */
export function escapedStoryCaptionText(caption: string): string {
  return presentationStoryCaptionText(caption)
}

/**
 * Deterministic non-semantic XML shell from authorized chapterScenes snapshot.
 * Must run only after verifyProductionStoryOracle; no new story bytes in wrappers.
 */
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
        const cap = presentationStoryCaptionText(sl.caption)
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
      const cap = presentationStoryCaptionText(sl.caption)
      return `  <story index="${idx}">${cap}</story>`
    })
    .join("\n")
  return `<currentSceneRevealedStories>\n${inner}\n</currentSceneRevealedStories>`
}
