import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  LOCALE_COOKIE,
  LOCALE_MAX_AGE,
  localeRequestHeaders,
  resolveRequestLocale,
} from "@/lib/locale/request"

/**
 * Resolves the page locale before render. API routes are excluded and read rs-locale themselves.
 * Does not redirect or rewrite the path.
 */
export function proxy(request: NextRequest) {
  const urlLang = request.nextUrl.searchParams.has("lang")
    ? request.nextUrl.searchParams.get("lang")
    : null
  const resolved = resolveRequestLocale(urlLang, request.cookies.get(LOCALE_COOKIE)?.value)
  const requestHeaders = localeRequestHeaders(request.headers, resolved.locale)
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  if (resolved.setCookie) {
    response.cookies.set(LOCALE_COOKIE, resolved.locale, {
      path: "/",
      sameSite: "lax",
      maxAge: LOCALE_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
    })
  }
  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
}
