import type { AppLocaleId } from "./types"

export const LOCALE_COOKIE = "rs-locale"
export const LOCALE_HEADER = "x-rs-locale"
export const LOCALE_MAX_AGE = 60 * 60 * 24 * 365

export type { AppLocaleId }

export type ResolvedRequestLocale = {
  locale: AppLocaleId
  /** True only when a recognized URL lang should overwrite the cookie. */
  setCookie: boolean
}

function normalized(value: string): string {
  return value.trim().toLowerCase()
}

/** Recognized inputs: en, zh-CN, and the zh / zh-Hans aliases. */
export function isRecognizedLocaleInput(value: string | null | undefined): boolean {
  if (value == null) return false
  const token = normalized(value)
  return token === "en" || token === "zh-cn" || token === "zh" || token === "zh-hans"
}

/**
 * Pure locale parse. Does not read or write module state.
 * zh and zh-Hans map to zh-CN. Anything else, including zh-TW and empty input, is en.
 */
export function parseLocale(value: string | null | undefined): AppLocaleId {
  if (!isRecognizedLocaleInput(value)) return "en"
  return normalized(value!) === "en" ? "en" : "zh-CN"
}

/**
 * URL lang wins only when it is recognized. An invalid lang is ignored and does not
 * authorize a cookie write, so a bad query cannot replace a valid rs-locale cookie.
 * Pass null when the lang parameter is absent. An empty string means the parameter is present but invalid.
 */
export function resolveRequestLocale(
  urlLang: string | null,
  cookieValue: string | null | undefined
): ResolvedRequestLocale {
  if (urlLang != null && isRecognizedLocaleInput(urlLang)) {
    return { locale: parseLocale(urlLang), setCookie: true }
  }
  return { locale: parseLocale(cookieValue), setCookie: false }
}

/**
 * Drop only the lang query. Returns null when lang is absent.
 * Other query parameters, the hash, and the current pathname stay.
 */
export function hrefWithoutLang(href: string): string | null {
  const url = new URL(href)
  if (!url.searchParams.has("lang")) return null
  url.searchParams.delete("lang")
  return `${url.pathname}${url.search}${url.hash}`
}

/** Replace any inbound x-rs-locale. Callers must not trust the client header. */
export function localeRequestHeaders(incoming: Headers, locale: AppLocaleId): Headers {
  const headers = new Headers(incoming)
  headers.set(LOCALE_HEADER, locale)
  return headers
}
