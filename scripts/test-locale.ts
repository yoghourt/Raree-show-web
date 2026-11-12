/**
 * Locale, prompt language, and request isolation checks.
 * Run: NODE_OPTIONS='--experimental-test-module-mocks' npx tsx scripts/test-locale.ts
 */
import assert from "node:assert/strict"
import { AsyncLocalStorage } from "node:async_hooks"
import { readFileSync } from "node:fs"
import path from "node:path"
import { mock } from "node:test"
import { NextRequest } from "next/server"
import { buildAssistantSystemPrompt } from "../src/lib/assistant-system-prompt"
import { localizeKnownError } from "../src/lib/locale/errors"
import { en } from "../src/lib/locale/en"
import { presentationStoryCaptionText } from "../src/lib/scene-assistant-context"
import { proxy } from "../src/proxy"
import {
  LOCALE_COOKIE,
  LOCALE_HEADER,
  hrefWithoutLang,
  localeRequestHeaders,
  parseLocale,
  resolveRequestLocale,
} from "../src/lib/locale/request"
import { zhCN } from "../src/lib/locale/zh-CN"

const cookieStore = new AsyncLocalStorage<string | undefined>()

mock.module("next/headers", {
  namedExports: {
    cookies: async () => {
      const value = cookieStore.getStore()
      return {
        get(name: string) {
          if (name !== LOCALE_COOKIE || value === undefined) return undefined
          return { name, value }
        },
      }
    },
  },
})

async function main() {
const { composeAssistantSystemPrompt } = await import("../src/lib/assistant-request-prompt")

const sampleContext = {
  tsid: "s1",
  workTitle: "Work",
  title: "Route",
  chapter_number: 1,
  chapter_title: "Ch",
  location: "Place",
  characters: ["A"],
  summary: "Sum",
}
const revealedXml = "<current><story>ORIGINAL CAPTION</story></current>"
const chapterXml = "<chapter/>"
const contextXml = "<context/>"

function assertEqual(actual: unknown, expected: unknown, label: string) {
  assert.equal(actual, expected, label)
}

function sameShape(left: unknown, right: unknown, label: string) {
  const leftFn = typeof left === "function"
  const rightFn = typeof right === "function"
  if (leftFn || rightFn) {
    assert.equal(leftFn, rightFn, `${label} function`)
    assert.equal(
      (left as (...args: never[]) => unknown).length,
      (right as (...args: never[]) => unknown).length,
      `${label} arity`
    )
    return
  }
  if (left !== null && right !== null && typeof left === "object" && typeof right === "object") {
    const leftKeys = Object.keys(left as object).sort()
    const rightKeys = Object.keys(right as object).sort()
    assert.deepEqual(leftKeys, rightKeys, `${label} keys`)
    for (const key of leftKeys) {
      sameShape(
        (left as Record<string, unknown>)[key],
        (right as Record<string, unknown>)[key],
        `${label}.${key}`
      )
    }
    return
  }
  assert.equal(typeof left, typeof right, label)
}

const parseCases: Array<[string | null | undefined, "en" | "zh-CN"]> = [
  ["en", "en"],
  ["zh-CN", "zh-CN"],
  ["zh", "zh-CN"],
  ["zh-Hans", "zh-CN"],
  ["zh-TW", "en"],
  ["", "en"],
  [null, "en"],
  [undefined, "en"],
  ["fr", "en"],
]

for (const [input, expected] of parseCases) {
  assertEqual(parseLocale(input), expected, `parseLocale(${String(input)})`)
}

assert.deepEqual(
  resolveRequestLocale("zh-CN", "en"),
  { locale: "zh-CN", setCookie: true },
  "valid zh-CN url overrides cookie"
)
assert.deepEqual(
  resolveRequestLocale("zh", "en"),
  { locale: "zh-CN", setCookie: true },
  "zh alias overrides cookie"
)
assert.deepEqual(
  resolveRequestLocale("zh-Hans", null),
  { locale: "zh-CN", setCookie: true },
  "zh-Hans alias sets cookie"
)
assert.deepEqual(
  resolveRequestLocale("en", "zh-CN"),
  { locale: "en", setCookie: true },
  "valid en url overrides cookie"
)
assert.deepEqual(
  resolveRequestLocale("zh-TW", "zh-CN"),
  { locale: "zh-CN", setCookie: false },
  "invalid url keeps zh-CN cookie"
)
assert.deepEqual(
  resolveRequestLocale("nope", "en"),
  { locale: "en", setCookie: false },
  "invalid url does not rewrite a valid en cookie"
)
assert.deepEqual(
  resolveRequestLocale("", "zh-CN"),
  { locale: "zh-CN", setCookie: false },
  "empty lang param is ignored"
)
assert.deepEqual(
  resolveRequestLocale(null, "zh-CN"),
  { locale: "zh-CN", setCookie: false },
  "missing lang uses cookie"
)
assert.deepEqual(
  resolveRequestLocale(null, null),
  { locale: "en", setCookie: false },
  "missing lang and cookie is en"
)
assert.deepEqual(
  resolveRequestLocale(null, "zh-TW"),
  { locale: "en", setCookie: false },
  "illegal cookie falls back without writing"
)
assert.deepEqual(
  resolveRequestLocale(null, "zh"),
  { locale: "zh-CN", setCookie: false },
  "cookie alias maps without a rewrite"
)

const forged = new Headers({ [LOCALE_HEADER]: "en" })
const replaced = localeRequestHeaders(forged, "zh-CN")
assertEqual(replaced.get(LOCALE_HEADER), "zh-CN", "forged x-rs-locale is overwritten")
assertEqual(
  hrefWithoutLang("http://localhost/works/a/scenes/b?lang=zh-CN&keep=1#part"),
  "/works/a/scenes/b?keep=1#part",
  "language switch keeps other query and hash"
)
assertEqual(
  hrefWithoutLang("http://localhost/works/a/scenes/b?keep=1#part"),
  null,
  "language switch leaves urls without lang untouched"
)

function proxyFor(url: string, cookie?: string) {
  const headers = new Headers()
  if (cookie) headers.set("cookie", `${LOCALE_COOKIE}=${cookie}`)
  headers.set(LOCALE_HEADER, "en")
  return proxy(new NextRequest(url, { headers }))
}

const promoted = proxyFor("http://localhost/?lang=zh", "en")
assertEqual(promoted.cookies.get(LOCALE_COOKIE)?.value, "zh-CN", "proxy writes canonical cookie")
assertEqual(
  promoted.headers.get("x-middleware-request-x-rs-locale"),
  "zh-CN",
  "proxy overwrites the forwarded locale header"
)
assert.equal(promoted.headers.get("location"), null, "proxy does not redirect")
const kept = proxyFor("http://localhost/?lang=zh-TW", "zh-CN")
assert.equal(kept.cookies.get(LOCALE_COOKIE), undefined, "invalid lang does not set cookie")
assertEqual(
  kept.headers.get("x-middleware-request-x-rs-locale"),
  "zh-CN",
  "invalid lang keeps the cookie locale on the request"
)
const untouched = proxyFor("http://localhost/works/a/scenes/b", "zh-CN")
assert.equal(untouched.cookies.get(LOCALE_COOKIE), undefined, "missing lang does not set cookie")

const env = process.env as { NODE_ENV?: string }
const previousNodeEnv = env.NODE_ENV
env.NODE_ENV = "production"
const secure = proxyFor("http://localhost/?lang=en")
env.NODE_ENV = previousNodeEnv
const secureCookie = secure.headers.get("set-cookie") ?? ""
assert.match(secureCookie, /Secure/i, "production cookie is Secure")
assert.doesNotMatch(secureCookie, /HttpOnly/i, "cookie stays readable to the client")

sameShape(en, zhCN, "catalog")

const englishPrompt = buildAssistantSystemPrompt(
  sampleContext,
  revealedXml,
  chapterXml,
  contextXml
)
const fixture = readFileSync(
  path.join(process.cwd(), "scripts/fixtures/assistant-prompt-en.txt"),
  "utf8"
)
assertEqual(englishPrompt, fixture, "default english prompt")
assertEqual(
  buildAssistantSystemPrompt(sampleContext, revealedXml, chapterXml, contextXml, "en"),
  fixture,
  "explicit english prompt"
)

const chinesePrompt = buildAssistantSystemPrompt(
  sampleContext,
  revealedXml,
  chapterXml,
  contextXml,
  "zh-CN"
)
assert.ok(chinesePrompt.includes(en.assistantPrompt.boundaryNote), "chinese prompt keeps english boundary")
assert.ok(chinesePrompt.includes(zhCN.assistantPrompt.closedDomainRefusal), "chinese refusal")
assert.ok(!chinesePrompt.includes(en.assistantPrompt.closedDomainRefusal), "english refusal replaced")
for (const line of [
  "Write the reader-facing explanation, analysis, and answer in Simplified Chinese.",
  "If the user explicitly asks for another language in this turn, follow that request.",
  "When quoting captions, book passages, or sources, keep the quoted text in its original language.",
  "You may explain English source text in Simplified Chinese.",
  "Do not translate or rewrite the injected story XML, and do not change its contents.",
  "Do not switch the entire answer to English merely because a quotation is in English.",
]) {
  assert.ok(chinesePrompt.includes(line), line)
}
assert.ok(chinesePrompt.includes("ORIGINAL CAPTION"), "source caption is not translated")
assert.ok(chinesePrompt.includes(revealedXml), "injected xml is unchanged")
assertEqual(presentationStoryCaptionText(""), "(No caption)", "xml placeholder stays english")

assertEqual(localizeKnownError(en.assistant.errorFailed, zhCN), zhCN.assistant.errorFailed, "known error")
assertEqual(
  localizeKnownError(`${en.assistant.errorFailed} `, zhCN),
  `${en.assistant.errorFailed} `,
  "near-miss stays original"
)
assertEqual(localizeKnownError("provider exploded", zhCN), "provider exploded", "unknown stays original")
assertEqual(
  localizeKnownError("Request failed (502)", zhCN),
  zhCN.assistant.errorRequestFailed(502),
  "request failed status"
)
assertEqual(
  localizeKnownError("Request failed (502) extra", zhCN),
  "Request failed (502) extra",
  "request failed near-miss"
)

const zhRequest = cookieStore.run("zh-CN", () =>
  composeAssistantSystemPrompt(sampleContext, revealedXml, chapterXml, contextXml)
)
const enRequest = cookieStore.run("en", () =>
  composeAssistantSystemPrompt(sampleContext, revealedXml, chapterXml, contextXml)
)
const missingRequest = cookieStore.run(undefined, () =>
  composeAssistantSystemPrompt(sampleContext, revealedXml, chapterXml, contextXml)
)
const illegalRequest = cookieStore.run("zh-TW", () =>
  composeAssistantSystemPrompt(sampleContext, revealedXml, chapterXml, contextXml)
)

const [zhFromCookie, enFromCookie, missingFromCookie, illegalFromCookie] = await Promise.all([
  zhRequest,
  enRequest,
  missingRequest,
  illegalRequest,
])

assertEqual(zhFromCookie, chinesePrompt, "zh-CN cookie prompt")
assertEqual(enFromCookie, fixture, "en cookie prompt")
assertEqual(missingFromCookie, fixture, "missing cookie prompt")
assertEqual(illegalFromCookie, fixture, "illegal cookie prompt")

console.log("test-locale: ok")
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
