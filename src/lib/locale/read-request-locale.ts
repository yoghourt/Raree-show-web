import { cookies } from "next/headers"
import { LOCALE_COOKIE, parseLocale, type AppLocaleId } from "@/lib/locale/request"

/** Per-request locale from rs-locale. Never stored on the module. */
export async function readRequestLocale(): Promise<AppLocaleId> {
  const store = await cookies()
  return parseLocale(store.get(LOCALE_COOKIE)?.value)
}
