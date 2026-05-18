import { createHash } from "node:crypto"

/** Deterministic v1: array order, chunks joined by "\n", no internal trim. */
export function normalizedRetrievedContext(contexts: string[]): string {
  return contexts.join("\n")
}

export function contextHash(normalized: string): string {
  return createHash("sha256").update(normalized, "utf8").digest("hex")
}

export function contextByteSize(normalized: string): number {
  return Buffer.byteLength(normalized, "utf8")
}

export function hashContexts(contexts: string[]): { hash: string; size: number; normalized: string } {
  const normalized = normalizedRetrievedContext(contexts)
  return {
    normalized,
    hash: contextHash(normalized),
    size: contextByteSize(normalized),
  }
}
