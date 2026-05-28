/**
 * RAGAS v2 caption oracle — production-authoritative raw-byte semantics.
 * Replaces v1 join("\n") string oracle.
 * Authority source: src/lib/production-story-oracle.ts#hashRawCaptions
 */
import { hashRawCaptions } from "@/lib/production-story-oracle"

export function captionHash(captions: string[]): { hash: string; size: number } {
  const { sha256, byteSize } = hashRawCaptions(captions)
  return { hash: sha256, size: byteSize }
}
