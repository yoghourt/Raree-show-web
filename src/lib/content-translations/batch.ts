export const PROMPT_VERSION = "p0-zh-cn-v1"
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

export function validateTranslationBatch(
  items: TranslationItem[],
  raw: string
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
    const text = texts[0].trim()
    if (!text) {
      failures.push({ ...identityOf(item), reason: "empty_text" })
      continue
    }
    const missing = placeholderTokens(item.source).filter((token) => !text.includes(token))
    if (missing.length > 0) {
      failures.push({ ...identityOf(item), reason: "placeholder" })
      continue
    }
    accepted.push({ ...item, text })
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
    "Use the name pairs when the same name appears.",
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
