type TranslationQueryError = {
  code?: string
  message?: string
}

/**
 * Before the empty table exists, or when that lookup's connection drops, the
 * reader keeps the canonical English text. Permission and other database
 * errors still surface.
 */
export function isMissingContentTranslationsTable(error: TranslationQueryError): boolean {
  if (error.code === "PGRST205" || error.code === "42P01") return true
  const message = error.message ?? ""
  return (
    message.includes("content_translations") &&
    (message.includes("schema cache") || message.includes("does not exist"))
  )
}

export function isTranslationLookupUnavailable(error: TranslationQueryError): boolean {
  if (isMissingContentTranslationsTable(error)) return true
  const message = error.message ?? ""
  return /socket hang up|fetch failed|FetchError|ECONNRESET|ETIMEDOUT|UND_ERR|abort/i.test(message)
}
