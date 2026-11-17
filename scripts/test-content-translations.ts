/**
 * Reader projection, frame identity, and translation-batch checks.
 * Run: npx tsx scripts/test-content-translations.ts
 */
import assert from "node:assert/strict"

import { canonicalSceneAssistantContext } from "../src/lib/content-translations/assistant-context"
import {
  acceptPlainTranslation,
  needsTranslation,
  plainTranslationPrompt,
  PROMPT_VERSION,
  translationPrompt,
  translationSlotDelay,
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

const glossary = { "Dong Zhuo": "董卓", "Cao Cao": "曹操", Liu: "刘" }
const mixedName = validateTranslationBatch(
  [{ entity_kind: "character", entity_key: "char_dong", field_key: "name", source: "Dong Zhuo" }],
  JSON.stringify([{ entity_kind: "character", entity_key: "char_dong", field_key: "name", text: "董 Zhuo" }])
)
assert.equal(mixedName.accepted.length, 0)
assert.equal(mixedName.failures[0]?.reason, "latin_name")
const repairedName = validateTranslationBatch(
  [{ entity_kind: "character", entity_key: "char_dong", field_key: "name", source: "Dong Zhuo" }],
  JSON.stringify([{ entity_kind: "character", entity_key: "char_dong", field_key: "name", text: "董 Zhuo" }]),
  glossary
)
assert.equal(repairedName.accepted[0]?.text, "董卓")
const caption = validateTranslationBatch(
  [{ entity_kind: "frame", entity_key: "frame_1", field_key: "caption", source: "The brothers rescued Dong Zhuo." }],
  JSON.stringify([
    { entity_kind: "frame", entity_key: "frame_1", field_key: "caption", text: "三兄弟将董 Zhuo 救出。" },
  ]),
  glossary
)
assert.equal(caption.accepted[0]?.text, "三兄弟将董卓救出。")
const description = validateTranslationBatch(
  [
    {
      entity_kind: "character",
      entity_key: "char_1",
      field_key: "description",
      source: "He served Dong Zhuo.",
    },
  ],
  JSON.stringify([
    { entity_kind: "character", entity_key: "char_1", field_key: "description", text: "他离开了。" },
  ]),
  glossary
)
assert.equal(description.accepted[0]?.text, "他离开了。")
const wallGlossary = { "The Wall": "绝境长城" }
const wallTitle = validateTranslationBatch(
  [
    {
      entity_kind: "scene",
      entity_key: "scene_wall",
      field_key: "title",
      source: "The Haunting Beyond the Wall",
    },
  ],
  JSON.stringify([
    { entity_kind: "scene", entity_key: "scene_wall", field_key: "title", text: "长城之外的惊骇" },
  ]),
  wallGlossary
)
assert.equal(wallTitle.accepted[0]?.text, "长城之外的惊骇")
const wallFragment = validateTranslationBatch(
  [
    {
      entity_kind: "scene",
      entity_key: "scene_wall",
      field_key: "title",
      source: "The Haunting Beyond the Wall",
    },
  ],
  JSON.stringify([
    { entity_kind: "scene", entity_key: "scene_wall", field_key: "title", text: "长城之外的 Wall" },
  ]),
  wallGlossary
)
assert.equal(wallFragment.failures[0]?.reason, "glossary_name")
const anxi = { "Anxi County": "安喜县" }
const glossed = validateTranslationBatch(
  [
    {
      entity_kind: "frame",
      entity_key: "frame_anxi",
      field_key: "caption",
      source: "Liu Bei earns the love of Anxi County.",
    },
  ],
  JSON.stringify([
    {
      entity_kind: "frame",
      entity_key: "frame_anxi",
      field_key: "caption",
      text: "刘备深得安xi县（安喜县）百姓爱戴。",
    },
  ]),
  anxi
)
assert.equal(glossed.accepted[0]?.text, "刘备深得安喜县百姓爱戴。")
const glossedHalf = validateTranslationBatch(
  [
    {
      entity_kind: "frame",
      entity_key: "frame_anxi",
      field_key: "caption",
      source: "Liu Bei earns the love of Anxi County.",
    },
  ],
  JSON.stringify([
    {
      entity_kind: "frame",
      entity_key: "frame_anxi",
      field_key: "caption",
      text: "刘备深得安xi县(安喜县)百姓爱戴。",
    },
  ]),
  anxi
)
assert.equal(glossedHalf.accepted[0]?.text, "刘备深得安喜县百姓爱戴。")
const bareFragment = validateTranslationBatch(
  [
    {
      entity_kind: "frame",
      entity_key: "frame_anxi",
      field_key: "caption",
      source: "Liu Bei earns the love of Anxi County.",
    },
  ],
  JSON.stringify([
    {
      entity_kind: "frame",
      entity_key: "frame_anxi",
      field_key: "caption",
      text: "刘备深得安xi县百姓爱戴。",
    },
  ]),
  anxi
)
assert.equal(bareFragment.failures[0]?.reason, "glossary_name")
const plainTitle = acceptPlainTranslation(
  { entity_kind: "scene", entity_key: "scene_wall", field_key: "title", source: "The Haunting Beyond the Wall" },
  "长城之外的惊骇",
  wallGlossary
)
assert.equal(plainTitle.ok && plainTitle.text, "长城之外的惊骇")
const wrappedTranslation = acceptPlainTranslation(
  { entity_kind: "location", entity_key: "loc_1", field_key: "description", source: "The political center of the empire." },
  '{ "translation": "帝国政治中心，皇宫与腐败朝臣的所在地。" }'
)
assert.equal(wrappedTranslation.ok && wrappedTranslation.text, "帝国政治中心，皇宫与腐败朝臣的所在地。")
const wrappedArray = acceptPlainTranslation(
  { entity_kind: "character", entity_key: "char_1", field_key: "description", source: "The last Han emperor." },
  '[ "汉献帝" ]'
)
assert.equal(wrappedArray.ok && wrappedArray.text, "汉献帝")
assert.match(plainTranslationPrompt("beyond the Wall", wallGlossary), /Return only the translation/)
assert.doesNotMatch(plainTranslationPrompt("beyond the Wall", wallGlossary), /entity_key/)
const repeatedToken = validateTranslationBatch(
  [{ entity_kind: "scene", entity_key: "scene_1", field_key: "title", source: "Cao Cao arrives" }],
  JSON.stringify([{ entity_kind: "scene", entity_key: "scene_1", field_key: "title", text: "曹 Cao 到来" }]),
  glossary
)
assert.equal(repeatedToken.accepted.length, 0)
assert.equal(repeatedToken.failures[0]?.reason, "glossary_name")
const fullRepeated = validateTranslationBatch(
  [{ entity_kind: "scene", entity_key: "scene_1", field_key: "title", source: "Cao Cao arrives" }],
  JSON.stringify([{ entity_kind: "scene", entity_key: "scene_1", field_key: "title", text: "Cao Cao 到来" }]),
  glossary
)
assert.equal(fullRepeated.accepted[0]?.text, "曹操到来")
const shorterName = validateTranslationBatch(
  [{ entity_kind: "frame", entity_key: "frame_2", field_key: "caption", source: "Liu Bei and Dong Zhuo met." }],
  JSON.stringify([
    { entity_kind: "frame", entity_key: "frame_2", field_key: "caption", text: "刘备与董卓相会。" },
  ]),
  { ...glossary, "Liu Bei": "刘备" }
)
assert.equal(shorterName.accepted[0]?.text, "刘备与董卓相会。")
assert.equal(PROMPT_VERSION, "p0-zh-cn-v4")
assert.match(translationPrompt([], glossary), /do not repeat the Chinese name in parentheses/)
assert.match(plainTranslationPrompt("beyond the Wall", wallGlossary), /do not repeat the Chinese name in parentheses/)
assert.equal(translationSlotDelay([], 1_000), 0)
assert.equal(translationSlotDelay([0], 1_000), 3_000)
assert.equal(translationSlotDelay([0], 5_000), 0)
assert.equal(translationSlotDelay([0, 4_000, 8_000], 9_000), 3_000)
const filled = Array.from({ length: 15 }, (_value, index) => index * 4_000)
assert.equal(translationSlotDelay(filled, 56_000), 4_000)
assert.equal(translationSlotDelay(filled, 57_000), 3_000)
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
