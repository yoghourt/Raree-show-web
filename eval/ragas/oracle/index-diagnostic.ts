import type { IndexDiagnostics, RareeSingleTurnSample } from "../types"

const STORY_INDEX_RE = /<story\s+index="(\d+)"/g

export function runIndexDiagnostic(sample: RareeSingleTurnSample): IndexDiagnostics {
  const warnings: string[] = []
  const authorized = new Set(sample.authorized_story_indices)
  const seen = new Map<number, number>()

  for (let chunkIdx = 0; chunkIdx < sample.contexts.length; chunkIdx++) {
    const chunk = sample.contexts[chunkIdx]
    if (!chunk.includes("<story")) continue

    let match: RegExpExecArray | null
    STORY_INDEX_RE.lastIndex = 0
    while ((match = STORY_INDEX_RE.exec(chunk)) !== null) {
      const index = Number.parseInt(match[1], 10)
      if (!Number.isFinite(index)) {
        warnings.push(`chunk[${chunkIdx}]: malformed story index "${match[1]}"`)
        continue
      }
      seen.set(index, (seen.get(index) ?? 0) + 1)
      if (!authorized.has(index)) {
        warnings.push(
          `chunk[${chunkIdx}]: story index ${index} not in authorized_story_indices [${sample.authorized_story_indices.join(",")}]`
        )
      }
    }
  }

  for (const [index, count] of seen) {
    if (count > 1) {
      warnings.push(`duplicate story index ${index} appears ${count} times across contexts`)
    }
  }

  return { storyIndexWarnings: warnings }
}
