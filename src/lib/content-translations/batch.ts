export const PROMPT_VERSION = "p0-zh-cn-v3"
export const TRANSLATION_REQUESTS_PER_MINUTE = 15
export const TRANSLATION_REQUEST_WINDOW_MS = 60_000
export const TRANSLATION_REQUEST_MIN_GAP_MS = TRANSLATION_REQUEST_WINDOW_MS / TRANSLATION_REQUESTS_PER_MINUTE

export function translationSlotDelay(
  timestamps: number[],
  now: number,
  limit = TRANSLATION_REQUESTS_PER_MINUTE,
  windowMs = TRANSLATION_REQUEST_WINDOW_MS,
  minGapMs = TRANSLATION_REQUEST_MIN_GAP_MS
): number {
  const recent = timestamps.filter((stamp) => now - stamp < windowMs).sort((left, right) => left - right)
  const gap = recent.length > 0 ? minGapMs - (now - recent[recent.length - 1]) : 0
  const windowDelay = recent.length >= limit ? windowMs - (now - recent[0]) : 0
  return Math.max(0, gap, windowDelay)
}
export const DEFAULT_TRANSLATION_MODEL = "gemini-3.5-flash-lite"

export type TranslationKind = "work" | "scene" | "frame" | "character" | "location"

export type TranslationItem = {
  entity_kind: TranslationKind
  entity_key: string
  field_key: string
  source: string
}

export type TranslationFailure = {
  entity_kind: string
  entity_key: string
  field_key: string
  reason: string
}

export function placeholderTokens(source: string): string[] {
  return [...source.matchAll(/\{[^{}]+\}/g)].map((match) => match[0])
}

export function needsTranslation(
  existingHash: string | undefined,
  nextHash: string,
  force: boolean
): boolean {
  if (force) return true
  if (!existingHash) return true
  return existingHash !== nextHash
}

function itemKey(item: Pick<TranslationItem, "entity_kind" | "entity_key" | "field_key">): string {
  return `${item.entity_kind}\u0000${item.entity_key}\u0000${item.field_key}`
}

export function parseModelJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  return JSON.parse(trimmed)
}

export function isChineseNameText(text: string): boolean {
  const visible = text.replace(/\{[^{}]+\}/g, " ")
  return visible.trim().length > 0 && !/[A-Za-z]/.test(visible)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function withoutPlaceholders(text: string): string {
  return text.replace(/\{[^{}]+\}/g, " ")
}

function containsWord(text: string, english: string): boolean {
  const pattern = new RegExp(`(^|[^A-Za-z])${escapeRegExp(english)}(?![A-Za-z])`, "i")
  return pattern.test(text)
}

function replaceWord(text: string, english: string, replacement: string): string {
  const pattern = new RegExp(`(^|[^A-Za-z])${escapeRegExp(english)}(?:'s)?(?![A-Za-z])`, "gi")
  return text.replace(pattern, `$1${replacement}`)
}

function usableGlossary(glossary: Record<string, string>): Array<[string, string]> {
  return Object.entries(glossary)
    .map(([english, chinese]) => [english.trim(), chinese.trim()] as [string, string])
    .filter(([english, chinese]) => /[A-Za-z]/.test(english) && isChineseNameText(chinese))
    .sort((left, right) => right[0].length - left[0].length)
}

function sourceMentions(source: string, english: string, entries: Array<[string, string]>): boolean {
  const visible = withoutPlaceholders(source)
  if (!containsWord(visible, english)) return false
  let rest = visible
  for (const [longer] of entries) {
    if (longer.length > english.length && containsWord(longer, english) && containsWord(visible, longer)) {
      rest = replaceWord(rest, longer, " ")
    }
  }
  return containsWord(rest, english)
}

function protectPlaceholders(text: string): { masked: string; tokens: string[] } {
  const tokens: string[] = []
  const masked = text.replace(/\{[^{}]+\}/g, (match) => {
    const slot = `\u0000${tokens.length}\u0000`
    tokens.push(match)
    return slot
  })
  return { masked, tokens }
}

function restorePlaceholders(masked: string, tokens: string[]): string {
  return masked.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => tokens[Number(index)] ?? "")
}

export function applyGlossaryNames(source: string, text: string, glossary: Record<string, string>): string {
  const entries = usableGlossary(glossary)
  const { masked, tokens } = protectPlaceholders(text)
  let out = masked
  for (const [english, chinese] of entries) {
    if (!sourceMentions(source, english, entries)) continue
    out = replaceWord(out, english, chinese)
    const parts = english.split(/\s+/)
    const characters = [...chinese]
    const unique = new Set(parts.map((part) => part.toLowerCase()))
    if (parts.length !== 2 || characters.length !== 2 || unique.size !== 2) continue
    if (!parts.every((part) => /^[A-Za-z][A-Za-z'-]*$/.test(part))) continue
    if (!characters.every((character) => /[\u3400-\u9fff]/.test(character))) continue
    const [firstToken, secondToken] = parts
    const [firstHan, secondHan] = characters
    const repairs: Array<[string, string]> = [
      [`${firstHan}\\s*${escapeRegExp(secondToken)}`, chinese],
      [`${escapeRegExp(firstToken)}\\s*${secondHan}`, chinese],
      [`${secondHan}\\s*${escapeRegExp(firstToken)}`, chinese],
      [`${escapeRegExp(secondToken)}\\s*${firstHan}`, chinese],
      [`${firstHan}\\s*${escapeRegExp(firstToken)}`, firstHan],
      [`${escapeRegExp(firstToken)}\\s*${firstHan}`, firstHan],
      [`${secondHan}\\s*${escapeRegExp(secondToken)}`, secondHan],
      [`${escapeRegExp(secondToken)}\\s*${secondHan}`, secondHan],
    ]
    for (const [sourcePattern, replacement] of repairs) {
      out = out.replace(new RegExp(sourcePattern, "gi"), replacement)
    }
  }
  out = out.replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, "$1")
  return restorePlaceholders(out, tokens)
}

function isNameField(item: TranslationItem): boolean {
  return (item.entity_kind === "character" || item.entity_kind === "location") && item.field_key === "name"
}

function glossaryLatinRemaining(source: string, text: string, glossary: Record<string, string>): boolean {
  const entries = usableGlossary(glossary)
  const visible = withoutPlaceholders(text)
  for (const [english] of entries) {
    if (!sourceMentions(source, english, entries)) continue
    for (const part of english.split(/\s+/)) {
      if (part.length < 2) continue
      if (!/^[A-Za-z][A-Za-z'-]*$/.test(part)) continue
      if (containsWord(visible, part)) return true
    }
  }
  return false
}

function finalizeTranslation(
  item: TranslationItem,
  text: string,
  glossary: Record<string, string>
): { ok: true; text: string } | { ok: false; reason: string } {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, reason: "empty_text" }
  if (placeholderTokens(item.source).some((token) => !trimmed.includes(token))) {
    return { ok: false, reason: "placeholder" }
  }
  const normalized = applyGlossaryNames(item.source, trimmed, glossary).replace(/\s{2,}/g, " ").trim()
  if (!normalized) return { ok: false, reason: "empty_text" }
  if (placeholderTokens(item.source).some((token) => !normalized.includes(token))) {
    return { ok: false, reason: "placeholder" }
  }
  if (isNameField(item) && !isChineseNameText(normalized)) return { ok: false, reason: "latin_name" }
  if (glossaryLatinRemaining(item.source, normalized, glossary)) return { ok: false, reason: "glossary_name" }
  return { ok: true, text: normalized }
}

export function validateTranslationBatch(
  items: TranslationItem[],
  raw: string,
  glossary: Record<string, string> = {}
): { accepted: Array<TranslationItem & { text: string }>; failures: TranslationFailure[] } {
  let parsed: unknown
  try {
    parsed = parseModelJson(raw)
  } catch {
    return {
      accepted: [],
      failures: items.map((item) => ({ ...identityOf(item), reason: "bad_json" })),
    }
  }
  if (!Array.isArray(parsed)) {
    return {
      accepted: [],
      failures: items.map((item) => ({ ...identityOf(item), reason: "bad_json" })),
    }
  }

  const requested = new Set(items.map(itemKey))
  const returned = new Map<string, unknown[]>()
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") {
      return {
        accepted: [],
        failures: items.map((item) => ({ ...identityOf(item), reason: "bad_json" })),
      }
    }
    const record = entry as Record<string, unknown>
    const key = itemKey({
      entity_kind: String(record.entity_kind ?? "") as TranslationKind,
      entity_key: String(record.entity_key ?? ""),
      field_key: String(record.field_key ?? ""),
    })
    if (!requested.has(key)) {
      return {
        accepted: [],
        failures: items.map((item) => ({ ...identityOf(item), reason: "unexpected_key" })),
      }
    }
    const list = returned.get(key) ?? []
    list.push(record.text)
    returned.set(key, list)
  }

  const accepted: Array<TranslationItem & { text: string }> = []
  const failures: TranslationFailure[] = []
  for (const item of items) {
    const texts = returned.get(itemKey(item)) ?? []
    if (texts.length !== 1 || typeof texts[0] !== "string") {
      failures.push({ ...identityOf(item), reason: "missing_key" })
      continue
    }
    const finalized = finalizeTranslation(item, texts[0], glossary)
    if (!finalized.ok) {
      failures.push({ ...identityOf(item), reason: finalized.reason })
      continue
    }
    accepted.push({ ...item, text: finalized.text })
  }
  return { accepted, failures }
}

function identityOf(item: TranslationItem): Omit<TranslationFailure, "reason"> {
  return {
    entity_kind: item.entity_kind,
    entity_key: item.entity_key,
    field_key: item.field_key,
  }
}

export function translationPrompt(items: TranslationItem[], glossary: Record<string, string>, context?: string): string {
  const glossaryLines = Object.entries(glossary).map(([source, translated]) => `${source} = ${translated}`)
  return [
    "Translate the source strings into Simplified Chinese.",
    "Do not add, omit, or explain. Keep each {token} placeholder unchanged.",
    "When a name pair applies, do not leave any Latin fragment of that English name.",
    "Write personal names and place names entirely in Chinese.",
    glossaryLines.length ? `Names:\n${glossaryLines.join("\n")}` : "Names:\n(none)",
    context ? `Context:\n${context}` : "Context:\n(none)",
    "Return a JSON array. Each object has entity_kind, entity_key, field_key, and text.",
    "Return exactly the requested keys and no others.",
    JSON.stringify(
      items.map((item) => ({
        entity_kind: item.entity_kind,
        entity_key: item.entity_key,
        field_key: item.field_key,
        source: item.source,
      }))
    ),
  ].join("\n\n")
}

export function responseSnippet(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 180)
}

export function plainTranslationPrompt(source: string, glossary: Record<string, string>): string {
  const entries = usableGlossary(glossary).filter(([english], _index, all) => sourceMentions(source, english, all))
  const names = entries.map(([english, chinese]) => `${english} = ${chinese}`)
  return [
    "Translate the source into Simplified Chinese.",
    "Return only the translation, with no explanation and no JSON.",
    "Keep each {token} placeholder unchanged.",
    "Do not leave any Latin fragment of an English name from the name list.",
    names.length ? `Names:\n${names.join("\n")}` : "Names:\n(none)",
    source,
  ].join("\n\n")
}

export function acceptPlainTranslation(
  item: TranslationItem,
  raw: string,
  glossary: Record<string, string> = {}
): { ok: true; text: string } | { ok: false; reason: string } {
  const text = translationTextFromPlain(raw)
  if (text === null) return { ok: false, reason: "missing_key" }
  return finalizeTranslation(item, text, glossary)
}

function translationTextFromPlain(raw: string): string | null {
  const text = raw.trim().replace(/^```(?:json|text)?\s*/i, "").replace(/\s*```$/, "").trim()
  if (!text) return null
  if (text.startsWith("{") || text.startsWith("[") || text.startsWith("\"")) {
    try {
      const parsed = JSON.parse(text) as unknown
      if (typeof parsed === "string") return parsed.trim() || null
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && typeof (parsed as { text?: unknown }).text === "string") {
        return ((parsed as { text: string }).text.trim() || null)
      }
      if (Array.isArray(parsed) && parsed.length === 1) {
        const entry = parsed[0] as { text?: unknown }
        if (entry && typeof entry.text === "string") return entry.text.trim() || null
      }
      return null
    } catch {
      if (text.startsWith("{") || text.startsWith("[")) return null
    }
  }
  return text
}
