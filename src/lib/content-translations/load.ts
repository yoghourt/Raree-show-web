import { supabase } from "@/lib/supabase"

import type { ContentTranslationRow } from "./dictionary"
import { isTranslationLookupUnavailable } from "./missing-table"

const LOOKUP_TIMEOUT_MS = 8000
const UNAVAILABLE_RETRY_MS = 60_000

let unavailableUntil = 0

export async function loadContentTranslations(keys: string[]): Promise<ContentTranslationRow[]> {
  const unique = [...new Set(keys.map((key) => key.trim()).filter(Boolean))]
  if (unique.length === 0) return []
  if (Date.now() < unavailableUntil) return []

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS)
  try {
    const { data, error } = await supabase
      .from("content_translations")
      .select("entity_kind, entity_key, field_key, text, source_hash")
      .eq("locale", "zh-CN")
      .in("entity_key", unique)
      .abortSignal(controller.signal)

    if (error) {
      if (isTranslationLookupUnavailable(error)) {
        unavailableUntil = Date.now() + UNAVAILABLE_RETRY_MS
        return []
      }
      throw new Error(`content_translations: ${error.message}`)
    }

    return (data ?? []) as ContentTranslationRow[]
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "fetch failed"
    if (message.startsWith("content_translations:")) throw caught
    if (isTranslationLookupUnavailable({ message })) {
      unavailableUntil = Date.now() + UNAVAILABLE_RETRY_MS
      return []
    }
    throw caught
  } finally {
    clearTimeout(timer)
  }
}
