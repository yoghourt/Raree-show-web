/**
 * Minimal runtime check for story list parsing + physical truncation (no LLM).
 * Run: pnpm exec tsx scripts/verify-story-truncation.ts
 */
import assert from "node:assert/strict"
import {
  effectiveStorySlidesFromV2,
  sliceRevealedStorySlides,
} from "../src/lib/story-images-v2"

const raw = [
  { url: "https://a", caption: "c0" },
  { url: "", caption: "skip-me" },
  { url: "https://b", caption: "c1" },
]
const slides = effectiveStorySlidesFromV2(raw)
assert.equal(slides.length, 2)
assert.equal(slides[0].caption, "c0")
assert.equal(slides[1].caption, "c1")

assert.equal(sliceRevealedStorySlides(slides, -1).length, 0)
assert.equal(sliceRevealedStorySlides(slides, 0).length, 1)
assert.equal(sliceRevealedStorySlides(slides, 0)[0].caption, "c0")
assert.equal(sliceRevealedStorySlides(slides, 1).length, 2)

assert.equal(sliceRevealedStorySlides(slides, 99).length, 2, "clamped to length")

console.log("[OK] verify-story-truncation")
