import type { AppLocaleId } from "@/lib/locale/types"

/** Client projection. The dictionary already passed the source-hash check. */
export function displayText(
  locale: AppLocaleId,
  canonical: string | null | undefined,
  translated: string | null | undefined
): string {
  const source = canonical ?? ""
  if (locale !== "zh-CN") return source
  const text = translated?.trim() ?? ""
  if (!text) return source
  return text
}
