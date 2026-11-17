import { sourceHash } from "./source-hash"

/**
 * Show the translation only when it is non-empty and was generated from the
 * current canonical field. Anything else stays the canonical string.
 */
export function projectDisplayText(
  canonical: string | null | undefined,
  translated: string | null | undefined,
  translatedSourceHash: string | null | undefined
): string {
  const source = canonical ?? ""
  if (source.normalize("NFC").trim() === "") return source
  const text = typeof translated === "string" ? translated.trim() : ""
  if (!text) return source
  if (!translatedSourceHash || translatedSourceHash !== sourceHash(source)) return source
  return text
}
