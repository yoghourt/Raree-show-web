"use client"

import { useLocale } from "@/lib/locale/provider"

export default function LanguageSwitch() {
  const { locale, messages, setLocale } = useLocale()

  return (
    <div className="rs-locale-switch" role="group" aria-label={messages.localeSwitch.groupAria}>
      <button
        type="button"
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
      >
        {messages.localeSwitch.en}
      </button>
      <button
        type="button"
        aria-pressed={locale === "zh-CN"}
        onClick={() => setLocale("zh-CN")}
      >
        {messages.localeSwitch.zhCN}
      </button>
      <style jsx>{`
        .rs-locale-switch {
          position: fixed;
          top: calc(20px + env(safe-area-inset-top, 0px));
          right: calc(24px + env(safe-area-inset-right, 0px));
          z-index: 40;
          display: flex;
          border: 1px solid var(--rs-gold-dim);
          background: rgba(26, 15, 10, 0.9);
          border-radius: 4px;
          overflow: hidden;
        }

        button {
          appearance: none;
          border: 0;
          background: transparent;
          color: var(--rs-text-dim);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 13px;
          letter-spacing: 0.04em;
          padding: 6px 10px;
          cursor: pointer;
        }

        button + button {
          border-left: 1px solid var(--rs-gold-dim);
        }

        button[aria-pressed="true"] {
          color: var(--rs-text);
          background: rgba(200, 169, 110, 0.16);
        }
      `}</style>
    </div>
  )
}
