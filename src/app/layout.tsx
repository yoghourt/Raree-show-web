import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { headers } from "next/headers"
import "./globals.css"
import LanguageSwitch from "@/components/raree/LanguageSwitch"
import { catalogs } from "@/lib/locale/catalog"
import { LocaleProvider } from "@/lib/locale/provider"
import { LOCALE_HEADER, parseLocale } from "@/lib/locale/request"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

async function requestLocale() {
  const headerList = await headers()
  return parseLocale(headerList.get(LOCALE_HEADER))
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale()
  const copy = catalogs[locale]
  return {
    title: { absolute: copy.meta.title },
    description: copy.meta.description,
    openGraph: {
      title: copy.meta.title,
      description: copy.meta.description,
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await requestLocale()

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable}`}
      // Extensions such as Immersive Translate write attributes on <html>
      // before hydration. The mismatch is outside this tree.
      suppressHydrationWarning
    >
      <body className="min-h-screen flex flex-col antialiased">
        <LocaleProvider initialLocale={locale}>
          <LanguageSwitch />
          {children}
        </LocaleProvider>
      </body>
    </html>
  )
}
