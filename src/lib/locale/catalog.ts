import { en } from "./en"
import type { AppLocaleId, LocaleMessages } from "./types"
import { zhCN } from "./zh-CN"

/** Immutable catalogs. This is not the active locale. */
export const messages = en

export const catalogs: Record<AppLocaleId, LocaleMessages> = {
  en,
  "zh-CN": zhCN,
}
