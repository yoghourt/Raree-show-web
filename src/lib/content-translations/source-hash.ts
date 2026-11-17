import { createHash } from "node:crypto"

/** NFC, trim, UTF-8 SHA-256, 64 lowercase hex. Shared by the reader and the script. */
export function sourceHash(canonical: string | null | undefined): string {
  const normalized = (canonical ?? "").normalize("NFC").trim()
  return createHash("sha256").update(normalized, "utf8").digest("hex")
}
