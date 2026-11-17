/**
 * P0-D: translate one work into zh-CN rows on content_translations.
 *
 *   npx tsx scripts/translate-work.ts --work-id <works.id>
 *   npx tsx scripts/translate-work.ts --work-id <works.id> --apply
 *
 * Without --apply the command only prints counts. It does not call a model
 * and does not write. Captions are included only with --include-captions,
 * and only for frames whose provenance is a bijection after frame_source_ids
 * exists. The script never writes English columns, frame columns, or embeddings.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

import {
  acceptPlainTranslation,
  DEFAULT_TRANSLATION_MODEL,
  isChineseNameText,
  needsTranslation,
  plainTranslationPrompt,
  PROMPT_VERSION,
  responseSnippet,
  translationPrompt,
  translationSlotDelay,
  validateTranslationBatch,
  type TranslationFailure,
  type TranslationItem,
  type TranslationKind,
} from "../src/lib/content-translations/batch"
import { resolveFrameSourceReviewId, type FrameProvenanceRef } from "../src/lib/content-translations/frames"
import { getFetchForGoogleGenerativeAI } from "../src/lib/gemini-proxy-fetch"
import { sourceHash } from "../src/lib/content-translations/source-hash"

dotenv.config({ path: path.join(process.cwd(), ".env.local"), quiet: true })

type ExistingRow = {
  entity_kind: string
  entity_key: string
  field_key: string
  source_hash: string
  text: string
}

type PlannedItem = TranslationItem & {
  source_hash: string
  phase: "names" | "fields" | "captions"
  context?: string
}

const FIELD_BY_KIND: Record<TranslationKind, string[]> = {
  work: ["title", "description"],
  scene: ["title", "chapter_title"],
  frame: ["caption"],
  character: ["name", "house", "description"],
  location: ["name", "description"],
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index < 0) return undefined
  return process.argv[index + 1]
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function readGlossary(filePath: string | undefined): Record<string, string> {
  if (!filePath) return {}
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) out[key] = value.trim()
    }
    return out
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ENOENT") return {}
    throw error
  }
}

function readKeyFilter(filePath: string | undefined): Set<string> | null {
  if (!filePath) return null
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { failures?: unknown }).failures)
      ? (parsed as { failures: unknown[] }).failures
      : []
  const keys = new Set<string>()
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const record = row as Record<string, unknown>
    if (typeof record.entity_kind !== "string" || typeof record.entity_key !== "string" || typeof record.field_key !== "string") {
      continue
    }
    keys.add(`${record.entity_kind}\u0000${record.entity_key}\u0000${record.field_key}`)
  }
  return keys
}

function namesFromContext(value: unknown): { characters: string[]; locations: string[] } {
  if (!value || typeof value !== "object") return { characters: [], locations: [] }
  const record = value as {
    characterAppearanceContext?: Array<{ name?: unknown }>
    locationContext?: { archiveName?: unknown }
  }
  const characters = (record.characterAppearanceContext ?? [])
    .map((appearance) => nonEmpty(appearance?.name))
    .filter((name): name is string => Boolean(name))
  const location = nonEmpty(record.locationContext?.archiveName)
  return { characters, locations: location ? [location] : [] }
}

async function main() {
  const workId = argValue("--work-id")?.trim()
  if (!workId) {
    console.error("missing --work-id <works.id uuid>")
    process.exitCode = 1
    return
  }
  const apply = hasFlag("--apply")
  const force = hasFlag("--force")
  const includeCaptions = hasFlag("--include-captions")
  const glossary = readGlossary(argValue("--glossary"))
  const keyFilter = readKeyFilter(argValue("--keys"))
  const model = process.env.TRANSLATION_MODEL?.trim() || DEFAULT_TRANSLATION_MODEL

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error("missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exitCode = 1
    return
  }
  if (apply && !process.env.GEMINI_API_KEY) {
    console.error("missing GEMINI_API_KEY")
    process.exitCode = 1
    return
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: work, error: workError } = await supabase
    .from("works")
    .select("id, tsid, title, description")
    .eq("id", workId)
    .maybeSingle()
  if (workError) throw new Error(workError.message)
  if (!work) throw new Error("work not found")

  const [scenesRes, charactersRes, locationsRes, registryRes] = await Promise.all([
    supabase
      .from("scenes")
      .select("tsid, title, chapter_title, chapter_number, order_index, story_images_v2, frame_provenance_v1, scene_contexts_v1")
      .eq("work_id", workId)
      .order("chapter_number", { ascending: true })
      .order("order_index", { ascending: true }),
    supabase.from("characters").select("tsid, name, house, description").eq("work_id", workId),
    supabase.from("locations").select("tsid, name, description").eq("work_id", workId),
    supabase.from("frame_source_ids").select("source_review_id").limit(1),
  ])
  if (scenesRes.error) throw new Error(scenesRes.error.message)
  if (charactersRes.error) throw new Error(charactersRes.error.message)
  if (locationsRes.error) throw new Error(locationsRes.error.message)
  const captionsReady = !registryRes.error

  const scenes = scenesRes.data ?? []
  const characters = charactersRes.data ?? []
  const locations = locationsRes.data ?? []
  const planned: PlannedItem[] = []
  const skippedIdentity: TranslationFailure[] = []
  let ambiguousFrames = 0

  const pushField = (
    kind: TranslationKind,
    key: string,
    field: string,
    source: string | null,
    phase: PlannedItem["phase"],
    context?: string
  ) => {
    if (!source) return
    if (!FIELD_BY_KIND[kind].includes(field)) return
    planned.push({
      entity_kind: kind,
      entity_key: key,
      field_key: field,
      source,
      source_hash: sourceHash(source),
      phase,
      context,
    })
  }

  pushField("work", String(work.tsid), "title", nonEmpty(work.title), "fields")
  pushField("work", String(work.tsid), "description", nonEmpty(work.description), "fields")
  for (const character of characters) {
    pushField("character", String(character.tsid), "name", nonEmpty(character.name), "names")
    pushField("character", String(character.tsid), "house", nonEmpty(character.house), "fields")
    pushField("character", String(character.tsid), "description", nonEmpty(character.description), "fields")
  }
  for (const location of locations) {
    pushField("location", String(location.tsid), "name", nonEmpty(location.name), "names")
    pushField("location", String(location.tsid), "description", nonEmpty(location.description), "fields")
  }
  for (const scene of scenes) {
    pushField("scene", String(scene.tsid), "title", nonEmpty(scene.title), "fields")
    pushField("scene", String(scene.tsid), "chapter_title", nonEmpty(scene.chapter_title), "fields")
    const frames = Array.isArray(scene.story_images_v2) ? scene.story_images_v2 : []
    const provenance = Array.isArray(scene.frame_provenance_v1)
      ? (scene.frame_provenance_v1 as FrameProvenanceRef[])
      : []
    const contexts = Array.isArray(scene.scene_contexts_v1) ? scene.scene_contexts_v1 : []
    frames.forEach((frame, index) => {
      const caption = frame && typeof frame === "object" ? nonEmpty((frame as { caption?: unknown }).caption) : null
      if (!caption) return
      const sourceReviewId = resolveFrameSourceReviewId(provenance, index)
      if (!sourceReviewId) {
        ambiguousFrames += 1
        if (includeCaptions) {
          skippedIdentity.push({
            entity_kind: "frame",
            entity_key: `${scene.tsid}:${index}`,
            field_key: "caption",
            reason: "ambiguous_frame_identity",
          })
        }
        return
      }
      if (!includeCaptions || !captionsReady) return
      const neighbors = [frames[index - 1], frames[index + 1]]
        .map((item) => (item && typeof item === "object" ? nonEmpty((item as { caption?: unknown }).caption) : null))
        .filter((item): item is string => Boolean(item))
      const contextRecord = contexts.find(
        (item) => item && typeof item === "object" && (item as { projectsToFrameIndex?: unknown }).projectsToFrameIndex === index
      )
      const names = namesFromContext(contextRecord)
      const context = [
        `work title: ${nonEmpty(work.title) ?? ""}`,
        `scene title: ${nonEmpty(scene.title) ?? ""}`,
        `caption: ${caption}`,
        neighbors.length ? `nearby captions: ${neighbors.join(" | ")}` : "",
        names.characters.length ? `characters: ${names.characters.join(", ")}` : "",
        names.locations.length ? `locations: ${names.locations.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
      pushField("frame", sourceReviewId, "caption", caption, "captions", context)
    })
  }

  const keys = [...new Set(planned.map((item) => item.entity_key))]
  let existing: ExistingRow[] = []
  let translationsTable = "present"
  if (keys.length > 0) {
    const existingRes = await supabase
      .from("content_translations")
      .select("entity_kind, entity_key, field_key, source_hash, text")
      .eq("locale", "zh-CN")
      .in("entity_key", keys)
    if (existingRes.error) {
      translationsTable = "missing"
      existing = []
    } else {
      existing = (existingRes.data ?? []) as ExistingRow[]
    }
  }

  const existingByKey = new Map(existing.map((row) => [`${row.entity_kind}\u0000${row.entity_key}\u0000${row.field_key}`, row]))
  const filtered = planned.filter((item) => {
    if (!keyFilter) return true
    return keyFilter.has(`${item.entity_kind}\u0000${item.entity_key}\u0000${item.field_key}`)
  })
  const pending = filtered.filter((item) =>
    needsTranslation(
      existingByKey.get(`${item.entity_kind}\u0000${item.entity_key}\u0000${item.field_key}`)?.source_hash,
      item.source_hash,
      force
    )
  )
  const unchanged = filtered.length - pending.length
  const captionPending = pending.filter((item) => item.phase === "captions").length
  const nonFramePending = pending.length - captionPending

  console.log(
    JSON.stringify(
      {
        work_id: workId,
        mode: apply ? "apply" : "dry-run",
        translations_table: translationsTable,
        captions_ready: captionsReady && includeCaptions,
        pending_non_frame: nonFramePending,
        pending_captions: captionPending,
        unchanged,
        skipped_empty_or_visual: "visual and empty fields are not counted",
        skipped_frame_identity: ambiguousFrames,
        visual_fields: 0,
      },
      null,
      2
    )
  )

  if (!apply) return

  const failures: TranslationFailure[] = [...skippedIdentity]
  const glossaryState = { ...glossary }
  for (const row of existing) {
    if ((row.entity_kind === "character" || row.entity_kind === "location") && row.field_key === "name") {
      const source = planned.find(
        (item) =>
          item.entity_kind === row.entity_kind &&
          item.entity_key === row.entity_key &&
          item.field_key === "name"
      )?.source
      if (source && isChineseNameText(row.text) && row.source_hash === sourceHash(source)) {
        glossaryState[source] = row.text.trim()
      }
    }
  }

  const fetchImpl = getFetchForGoogleGenerativeAI()
  const requestTimestamps: number[] = []
  for (const phase of ["names", "fields", "captions"] as const) {
    const phaseItems = pending.filter((item) => item.phase === phase)
    for (let offset = 0; offset < phaseItems.length; offset += 12) {
      const chunk = phaseItems.slice(offset, offset + 12)
      const sharedContext = phase === "captions" && nonEmpty(work.description) ? `work description: ${nonEmpty(work.description)}` : ""
      const context = [sharedContext, ...chunk.map((item) => item.context)].filter(Boolean).join("\n---\n")
      let raw = ""
      try {
        raw = await generateTranslation(
          fetchImpl,
          model,
          translationPrompt(chunk, glossaryState, context),
          requestTimestamps
        )
      } catch (error) {
        const reason = error instanceof Error ? error.message : "model_error"
        failures.push(...chunk.map((item) => ({ ...item, reason })))
        continue
      }
      let validated = validateTranslationBatch(chunk, raw, glossaryState)
      if (validated.failures.length > 0 && chunk.length > 1) {
        const recovered: typeof validated.accepted = []
        const stillFailed: TranslationFailure[] = []
        for (const failed of validated.failures) {
          const item = chunk.find(
            (candidate) =>
              candidate.entity_kind === failed.entity_kind &&
              candidate.entity_key === failed.entity_key &&
              candidate.field_key === failed.field_key
          )
          if (!item) {
            stillFailed.push(failed)
            continue
          }
          try {
            const oneRaw = await generateTranslation(
              fetchImpl,
              model,
              translationPrompt([item], glossaryState, item.context),
              requestTimestamps
            )
            const one = validateTranslationBatch([item], oneRaw, glossaryState)
            recovered.push(...one.accepted)
            stillFailed.push(...one.failures)
          } catch (error) {
            const reason = error instanceof Error ? error.message : "model_error"
            stillFailed.push({ ...failed, reason })
          }
        }
        validated = { accepted: [...validated.accepted, ...recovered], failures: stillFailed }
      }
      const plainRecovered: typeof validated.accepted = []
      const unresolved: TranslationFailure[] = []
      for (const failed of validated.failures) {
        if (failed.reason !== "missing_key" && failed.reason !== "bad_json" && failed.reason !== "unexpected_key") {
          unresolved.push(failed)
          continue
        }
        const item = chunk.find(
          (candidate) =>
            candidate.entity_kind === failed.entity_kind &&
            candidate.entity_key === failed.entity_key &&
            candidate.field_key === failed.field_key
        )
        if (!item) {
          unresolved.push(failed)
          continue
        }
        try {
          const plainRaw = await generateTranslation(
            fetchImpl,
            model,
            plainTranslationPrompt(item.source, glossaryState),
            requestTimestamps
          )
          const plain = acceptPlainTranslation(item, plainRaw, glossaryState)
          if (plain.ok) plainRecovered.push({ ...item, text: plain.text })
          else unresolved.push({ ...failed, reason: plain.reason, response: responseSnippet(plainRaw) })
        } catch (error) {
          const reason = error instanceof Error ? error.message : "model_error"
          unresolved.push({ ...failed, reason })
        }
      }
      validated = { accepted: [...validated.accepted, ...plainRecovered], failures: unresolved }
      failures.push(...validated.failures)
      for (const item of validated.accepted) {
        const sourceHashValue = chunk.find(
          (candidate) =>
            candidate.entity_kind === item.entity_kind &&
            candidate.entity_key === item.entity_key &&
            candidate.field_key === item.field_key
        )?.source_hash
        if (!sourceHashValue) {
          failures.push({ ...item, reason: "missing_source_hash" })
          continue
        }
        const written = await upsertTranslation(
          supabase,
          { ...item, source_hash: sourceHashValue },
          model
        )
        if (!written.ok) {
          failures.push({ ...item, reason: written.reason })
          continue
        }
        if (
          (item.entity_kind === "character" || item.entity_kind === "location") &&
          item.field_key === "name" &&
          isChineseNameText(item.text)
        ) {
          glossaryState[item.source] = item.text
        }
      }
    }
  }

  if (failures.length > 0) {
    const directory = path.join(process.cwd(), ".tmp", "translate-reports")
    mkdirSync(directory, { recursive: true })
    const reportPath = path.join(directory, `translate-work-${workId}.json`)
    writeFileSync(
      reportPath,
      JSON.stringify({ work_id: workId, prompt_version: PROMPT_VERSION, model, failures }, null, 2)
    )
    console.log(JSON.stringify({ failures: failures.length, report: reportPath }))
    process.exitCode = 1
    return
  }
  console.log(JSON.stringify({ failures: 0, prompt_version: PROMPT_VERSION, model }))
}

const MODEL_ATTEMPTS = 4
const RATE_LIMIT_RETRY_MS = 60_000

class ModelHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs: number | null
  ) {
    super(`model_http_${status}`)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryAfterDelay(response: Response): number | null {
  const raw = response.headers.get("retry-after")
  if (!raw) return null
  const seconds = Number(raw)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(raw)
  if (Number.isNaN(date)) return null
  return Math.max(0, date - Date.now())
}

async function waitForTranslationSlot(timestamps: number[]): Promise<void> {
  const wait = translationSlotDelay(timestamps, Date.now())
  if (wait >= 1000) console.log(JSON.stringify({ wait_ms: wait, reason: "request_pace" }))
  if (wait > 0) await sleep(wait)
}

async function generateTranslation(
  fetchImpl: typeof fetch,
  model: string,
  prompt: string,
  timestamps: number[]
): Promise<string> {
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= MODEL_ATTEMPTS; attempt++) {
    await waitForTranslationSlot(timestamps)
    timestamps.push(Date.now())
    try {
      return await requestTranslation(fetchImpl, model, prompt)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("model_error")
      const status = error instanceof ModelHttpError ? error.status : 0
      if ((status !== 429 && status !== 503) || attempt === MODEL_ATTEMPTS) throw lastError
      const retryAfter = error instanceof ModelHttpError ? error.retryAfterMs ?? 0 : 0
      const wait = Math.max(RATE_LIMIT_RETRY_MS, retryAfter)
      console.log(JSON.stringify({ wait_ms: wait, reason: lastError.message, attempt }))
      await sleep(wait)
    }
  }
  throw lastError ?? new Error("model_error")
}

async function requestTranslation(fetchImpl: typeof fetch, model: string, prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY ?? ""
  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
        },
      }),
    }
  )
  if (!response.ok) {
    throw new ModelHttpError(response.status, retryAfterDelay(response))
  }
  const body = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? ""
  if (!text.trim()) throw new Error("empty_model_response")
  return text
}

async function upsertTranslation(
  supabase: SupabaseClient,
  item: TranslationItem & { text: string; source_hash: string },
  model: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const now = new Date().toISOString()
  const { error } = await supabase.from("content_translations").upsert(
    {
      entity_kind: item.entity_kind,
      entity_key: item.entity_key,
      field_key: item.field_key,
      locale: "zh-CN",
      text: item.text,
      source_hash: item.source_hash,
      model,
      prompt_version: PROMPT_VERSION,
      generated_at: now,
      updated_at: now,
    },
    { onConflict: "entity_kind,entity_key,field_key,locale" }
  )
  if (error) return { ok: false, reason: "upsert_failed" }
  return { ok: true }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "translate_work_failed"
  console.error(message)
  process.exitCode = 1
})
