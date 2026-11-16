/**
 * Reader projection, frame identity, and translation-batch checks.
 * Run: npx tsx scripts/test-content-translations.ts
 */
import assert from "node:assert/strict"

import { canonicalSceneAssistantContext } from "../src/lib/content-translations/assistant-context"
import {
  needsTranslation,
  validateTranslationBatch,
} from "../src/lib/content-translations/batch"
import { buildDisplayDictionary } from "../src/lib/content-translations/dictionary"
import { displayText } from "../src/lib/content-translations/display"
import {
  frameSourceReviewIdsForEffectiveFrames,
  resolveFrameSourceReviewId,
} from "../src/lib/content-translations/frames"
import {
  isMissingContentTranslationsTable,
  isTranslationLookupUnavailable,
} from "../src/lib/content-translations/missing-table"
import { projectDisplayText } from "../src/lib/content-translations/project"
import { sourceHash } from "../src/lib/content-translations/source-hash"

const winterfell = "Winterfell"
const hash = sourceHash(`  ${winterfell}  `)
assert.equal(hash, sourceHash(winterfell.normalize("NFC")))
assert.equal(hash, sourceHash(winterfell))
assert.match(hash, /^[0-9a-f]{64}$/)

assert.equal(projectDisplayText(`  ${winterfell}  `, "临冬城", hash), "临冬城")
assert.equal(projectDisplayText(winterfell, "临冬城", "f".repeat(64)), winterfell)
assert.equal(projectDisplayText(winterfell, "   ", hash), winterfell)
assert.equal(projectDisplayText(winterfell, null, hash), winterfell)
assert.equal(projectDisplayText("   ", "空白", sourceHash("")), "   ")

const rows = [
  {
    entity_kind: "work",
    entity_key: "work_1",
    field_key: "title",
    text: "临冬城",
    source_hash: sourceHash(winterfell),
  },
  {
    entity_kind: "work",
    entity_key: "work_1",
    field_key: "description",
    text: "过期",
    source_hash: "a".repeat(64),
  },
]
const dictionary = buildDisplayDictionary(rows, {
  works: [{ id: "work_1", title: winterfell, description: "A castle" }],
})
assert.equal(dictionary.work.work_1?.title, "临冬城")
assert.equal(dictionary.work.work_1?.description, undefined)
assert.equal(displayText("zh-CN", winterfell, dictionary.work.work_1?.title), "临冬城")
assert.equal(displayText("en", winterfell, dictionary.work.work_1?.title), winterfell)

const provenance = [
  { sourceReviewId: "id-a", frameIndex: 0 },
  { sourceReviewId: "id-b", frameIndex: 1 },
]
assert.equal(resolveFrameSourceReviewId(provenance, 1), "id-b")
assert.equal(
  resolveFrameSourceReviewId(
    [
      { sourceReviewId: "id-a", frameIndex: 0 },
      { sourceReviewId: "id-b", frameIndex: 2 },
      { sourceReviewId: "id-c", frameIndex: 1 },
    ],
    1
  ),
  null
)
assert.equal(
  resolveFrameSourceReviewId(
    [
      { sourceReviewId: "id-a", frameIndex: 0 },
      { sourceReviewId: "id-a", frameIndex: 1 },
    ],
    1
  ),
  null
)
const frames = [
  { url: "https://cdn.example/a.png", caption: "First" },
  { url: "", caption: "" },
  { url: "https://cdn.example/c.png", caption: "Third" },
]
assert.deepEqual(
  frameSourceReviewIdsForEffectiveFrames(frames, [
    { sourceReviewId: "id-a", frameIndex: 0 },
    { sourceReviewId: "id-b", frameIndex: 1 },
    { sourceReviewId: "id-c", frameIndex: 2 },
  ]),
  ["id-a", "id-c"]
)

const assistantBody = {
  sceneContext: canonicalSceneAssistantContext({
    tsid: "scene_1",
    workTitle: "A Clash of Kings",
    title: winterfell,
    chapter_number: 1,
    chapter_title: null,
    location: winterfell,
    characters: ["Jon Snow"],
    summary: "The yard is quiet.",
    unnamedWorkFallback: "Untitled",
  }),
  displayDictionary: dictionary,
}
assert.equal(assistantBody.sceneContext.title, winterfell)
assert.equal(assistantBody.sceneContext.workTitle, "A Clash of Kings")
assert.deepEqual(assistantBody.sceneContext.characters, ["Jon Snow"])
assert.equal(JSON.stringify(assistantBody.sceneContext).includes("临冬城"), false)

const items = [
  { entity_kind: "character" as const, entity_key: "char_1", field_key: "name", source: "Jon Snow" },
]
const bad = validateTranslationBatch(items, "{")
assert.equal(bad.accepted.length, 0)
assert.equal(bad.failures[0]?.reason, "bad_json")
const empty = validateTranslationBatch(items, JSON.stringify([{ ...items[0], text: "  " }]))
assert.equal(empty.accepted.length, 0)
assert.equal(empty.failures[0]?.reason, "empty_text")
const placeholder = validateTranslationBatch(
  [{ ...items[0], source: "Hello {name}" }],
  JSON.stringify([{ ...items[0], text: "你好" }])
)
assert.equal(placeholder.accepted.length, 0)
const ok = validateTranslationBatch(
  [{ ...items[0], source: "Hello {name}" }],
  JSON.stringify([{ ...items[0], text: "你好 {name}" }])
)
assert.equal(ok.accepted[0]?.text, "你好 {name}")
assert.equal(needsTranslation(hash, hash, false), false)
assert.equal(needsTranslation(hash, hash, true), true)
assert.equal(needsTranslation(undefined, hash, false), true)
assert.equal(
  isMissingContentTranslationsTable({
    code: "PGRST205",
    message: "Could not find the table 'public.content_translations' in the schema cache",
  }),
  true
)
assert.equal(isMissingContentTranslationsTable({ code: "42501", message: "permission denied" }), false)
assert.equal(
  isTranslationLookupUnavailable({
    message:
      "FetchError: request to https://example.supabase.co/rest/v1/content_translations failed, reason: socket hang up",
  }),
  true
)
assert.equal(isTranslationLookupUnavailable({ code: "42501", message: "permission denied" }), false)
assert.equal(isTranslationLookupUnavailable({ message: "The operation was aborted." }), true)

console.log("content translation checks passed")
