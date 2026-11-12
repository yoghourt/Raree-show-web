export { en, type EnLocale } from "./en"
export { zhCN } from "./zh-CN"
export { catalogs, messages } from "./catalog"
export type { AppLocale, AppLocaleId, LocaleMessages } from "./types"
export {
  LOCALE_COOKIE,
  LOCALE_HEADER,
  LOCALE_MAX_AGE,
  isRecognizedLocaleInput,
  localeRequestHeaders,
  parseLocale,
  resolveRequestLocale,
  type ResolvedRequestLocale,
} from "./request"
