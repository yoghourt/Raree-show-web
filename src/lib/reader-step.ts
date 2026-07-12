/**
 * Reader Step — implementation alias helpers (Runtime Reading RC1).
 *
 * Authority (read-only; do not redefine here):
 *   SPEC-RDX-001 (raree-show-admin) — Reader Step is the Runtime consumption atom
 *   W-01 — browser orchestration of progress commit
 *   Runtime Reading Governance RC1 — baseline release
 *
 * Product Freeze (Sprint #1): helpers MUST preserve existing runtime meaning.
 * `imageIndex` in navigation state implements Reader Step index within
 * effective frames; this module does not rename runtime fields.
 */

/** Documentation alias: Reader Step index within effective Reading Frames (0-based). */
export type ReaderStepIndex = number

/**
 * W-01 `readUpToStoryIndexLast` formula — exact copy of prior inline logic.
 * Empty effective frame list ⇒ `-1`; otherwise the current Reader Step index.
 */
export function readUpToStoryIndexLastFromStep(
  effectiveFrameCount: number,
  readerStepIndex: ReaderStepIndex
): number {
  return effectiveFrameCount === 0 ? -1 : readerStepIndex
}
