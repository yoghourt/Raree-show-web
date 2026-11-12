import { en } from "./en"

type WidenLocale<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => R extends string ? string : R
  : T extends string
    ? string
    : T extends object
      ? { [K in keyof T]: WidenLocale<T[K]> }
      : T

/** Message catalog. English `en` is the only key structure. */
export type LocaleMessages = WidenLocale<typeof en>

export type AppLocaleId = "en" | "zh-CN"

/** @deprecated Use LocaleMessages. Kept so older imports still name the catalog shape. */
export type AppLocale = LocaleMessages
