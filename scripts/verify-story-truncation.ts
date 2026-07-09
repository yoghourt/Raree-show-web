/**
 * Minimal runtime check for story list parsing + physical truncation (no LLM).
 * Run: pnpm exec tsx scripts/verify-story-truncation.ts
 */
import assert from "node:assert/strict"
import {
  effectiveReadingFramesFromV2,
  sliceRevealedReadingFrames,
} from "../src/lib/reading-frames"

const raw = [
  { url: "https://a", caption: "c0" },
  { url: "", caption: "skip-me" },
  { url: "https://b", caption: "c1" },
]
const frames = effectiveReadingFramesFromV2(raw)
assert.equal(frames.length, 2)
assert.equal(frames[0].caption, "c0")
assert.equal(frames[1].caption, "c1")

assert.equal(sliceRevealedReadingFrames(frames, -1).length, 0)
assert.equal(sliceRevealedReadingFrames(frames, 0).length, 1)
assert.equal(sliceRevealedReadingFrames(frames, 0)[0].caption, "c0")
assert.equal(sliceRevealedReadingFrames(frames, 1).length, 2)

assert.equal(sliceRevealedReadingFrames(frames, 99).length, 2, "clamped to length")

console.log("[OK] verify-story-truncation")
