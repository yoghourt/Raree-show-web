"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { catalogs } from "./catalog"
import { hrefWithoutLang, LOCALE_COOKIE, LOCALE_MAX_AGE, type AppLocaleId } from "./request"
import { readingDocumentTitle } from "./title"
import type { LocaleMessages } from "./types"

export type PageTitle =
  | { kind: "home" }
  | { kind: "reading"; subject: string }

type LocaleContextValue = {
  locale: AppLocaleId
  messages: LocaleMessages
  setLocale: (next: AppLocaleId) => void
  registerPageTitle: (title: PageTitle) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function titleFor(locale: AppLocaleId, title: PageTitle): string {
  const brand = catalogs[locale].meta.title
  if (title.kind === "reading") return readingDocumentTitle(title.subject, brand)
  return brand
}

function writeLocaleCookie(locale: AppLocaleId) {
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_MAX_AGE}; SameSite=Lax${secure}`
}

function clearLangParam() {
  const next = hrefWithoutLang(window.location.href)
  if (next == null) return
  window.history.replaceState(window.history.state, "", next)
}

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: AppLocaleId
  children: ReactNode
}) {
  const [locale, setLocaleState] = useState<AppLocaleId>(initialLocale)
  const localeRef = useRef(initialLocale)
  const titleRef = useRef<PageTitle>({ kind: "home" })

  const registerPageTitle = useCallback((title: PageTitle) => {
    titleRef.current = title
    document.title = titleFor(localeRef.current, title)
  }, [])

  const setLocale = useCallback((next: AppLocaleId) => {
    localeRef.current = next
    setLocaleState(next)
    document.documentElement.lang = next
    document.title = titleFor(next, titleRef.current)
    writeLocaleCookie(next)
    clearLangParam()
  }, [])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      messages: catalogs[locale],
      setLocale,
      registerPageTitle,
    }),
    [locale, registerPageTitle, setLocale]
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext)
  if (!value) {
    throw new Error("useLocale must be used within LocaleProvider")
  }
  return value
}
