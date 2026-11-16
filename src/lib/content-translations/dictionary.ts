import { projectDisplayText } from "./project"
import {
  emptyDisplayDictionary,
  type DisplayDictionary,
  type TranslationFieldMap,
  type TranslationKind,
} from "./types"

export type ContentTranslationRow = {
  entity_kind: string
  entity_key: string
  field_key: string
  text: string
  source_hash: string
}

function put(
  dictionary: DisplayDictionary,
  kind: TranslationKind,
  key: string,
  field: keyof TranslationFieldMap,
  canonical: string | null | undefined,
  row: ContentTranslationRow | undefined
) {
  if (!key || !row || row.entity_kind !== kind || row.field_key !== field) return
  const projected = projectDisplayText(canonical, row.text, row.source_hash)
  if (!projected.trim() || projected === (canonical ?? "")) return
  const bucket = dictionary[kind][key] ?? {}
  bucket[field] = projected
  dictionary[kind][key] = bucket
}

function rowFor(
  rows: ContentTranslationRow[],
  kind: TranslationKind,
  key: string,
  field: string
) {
  return rows.find(
    (row) => row.entity_kind === kind && row.entity_key === key && row.field_key === field
  )
}

export function buildDisplayDictionary(
  rows: ContentTranslationRow[],
  sources: {
    works?: Array<{ id: string; title: string; description?: string | null }>
    scenes?: Array<{ id: string; title: string; chapter_title?: string | null }>
    frames?: Array<{ sourceReviewId: string | null; caption: string }>
    characters?: Array<{ id: string; name: string; house?: string | null; description?: string | null }>
    locations?: Array<{ id: string; name: string; description?: string | null }>
  }
): DisplayDictionary {
  const dictionary = emptyDisplayDictionary()
  for (const work of sources.works ?? []) {
    put(dictionary, "work", work.id, "title", work.title, rowFor(rows, "work", work.id, "title"))
    put(dictionary, "work", work.id, "description", work.description, rowFor(rows, "work", work.id, "description"))
  }
  for (const scene of sources.scenes ?? []) {
    put(dictionary, "scene", scene.id, "title", scene.title, rowFor(rows, "scene", scene.id, "title"))
    put(
      dictionary,
      "scene",
      scene.id,
      "chapter_title",
      scene.chapter_title,
      rowFor(rows, "scene", scene.id, "chapter_title")
    )
  }
  for (const frame of sources.frames ?? []) {
    if (!frame.sourceReviewId) continue
    put(
      dictionary,
      "frame",
      frame.sourceReviewId,
      "caption",
      frame.caption,
      rowFor(rows, "frame", frame.sourceReviewId, "caption")
    )
  }
  for (const character of sources.characters ?? []) {
    put(dictionary, "character", character.id, "name", character.name, rowFor(rows, "character", character.id, "name"))
    put(dictionary, "character", character.id, "house", character.house, rowFor(rows, "character", character.id, "house"))
    put(
      dictionary,
      "character",
      character.id,
      "description",
      character.description,
      rowFor(rows, "character", character.id, "description")
    )
  }
  for (const location of sources.locations ?? []) {
    put(dictionary, "location", location.id, "name", location.name, rowFor(rows, "location", location.id, "name"))
    put(
      dictionary,
      "location",
      location.id,
      "description",
      location.description,
      rowFor(rows, "location", location.id, "description")
    )
  }
  return dictionary
}
