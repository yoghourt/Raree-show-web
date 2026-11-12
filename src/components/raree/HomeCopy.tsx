"use client"

import { useLayoutEffect } from "react"
import { useLocale } from "@/lib/locale/provider"

export function HomeTitle() {
  const { locale, messages } = useLocale()

  return (
    <h1
      className={`font-serif text-4xl font-light text-[#e8dcc8] drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] sm:text-5xl ${
        locale === "zh-CN" ? "tracking-normal" : "tracking-wide"
      }`}
    >
      {messages.meta.title}
    </h1>
  )
}

export function HomeTagline() {
  const { messages, registerPageTitle } = useLocale()

  useLayoutEffect(() => {
    registerPageTitle({ kind: "home" })
  }, [registerPageTitle])

  return (
    <p className="mt-3 text-lg text-[#c4a574]/95 sm:text-xl">{messages.home.tagline}</p>
  )
}

export function HomeEmpty() {
  const { messages } = useLocale()
  return <p className="text-center text-[#a08060]">{messages.home.noWorks}</p>
}
