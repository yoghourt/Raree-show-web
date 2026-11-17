/**
 * P2-B no-spoiler Stage 2 prompt text. This checks the prompt passed to the model.
 * It does not call a model and is not evidence that the model will comply.
 * Run: npx tsx scripts/test-reader-guide-p2b-prompt.ts
 */
import assert from "node:assert/strict"
import { buildAssistantSystemPrompt } from "../src/lib/assistant-system-prompt"

const scene = {
  tsid: "scene_1787821760006",
  workTitle: "三国演义",
  title: "The oath",
  chapter_number: 1,
  chapter_title: null,
  location: "Zhuozhou",
  characters: ["Zhang Jue"],
  summary: "",
}
const revealed = "<currentSceneRevealedStories><story>Zhang Jue leads the Yellow Turban Rebellion.</story></currentSceneRevealedStories>"
const chapter = "<chapterScenesInProgress><scene><story>Zhang Jue leads the Yellow Turban Rebellion.</story></scene></chapterScenesInProgress>"
const context = "<context></context>"

const none = buildAssistantSystemPrompt(scene, revealed, chapter, context, "zh-CN", {
  visibility: "none",
  characterCards: [],
  omissionNote: "Some earlier revealed scenes were omitted for length.",
})
const expanded = buildAssistantSystemPrompt(scene, revealed, chapter, context, "zh-CN", {
  visibility: "expanded",
  characterCards: [{ name: "Zhang Jue", description: "He dies of illness after the rebellion fails." }],
})

assert.ok(none.includes(revealed), "none prompt receives the revealed caption context")
assert.ok(none.includes(chapter), "none prompt receives the chapter caption context")
assert.ok(!none.includes("[Character cards"), "production none prompt has no character cards")
assert.ok(!none.includes("He dies of illness after the rebellion fails."), "none prompt does not receive the later character blurb")
assert.ok(none.includes("[No-spoiler limit]"), "no-spoiler limit is in the built prompt")
assert.ok(none.includes("identity, occupation, organization, era, culture, institutions, geography, society"), "static identity and social background")
assert.ok(none.includes("causes or present meaning of an event the captions already name"), "background of a revealed event")
assert.ok(none.includes("unrevealed death, ending, or fate"), "no unrevealed death")
assert.ok(none.includes("unrevealed victory, defeat, or result of a scheme"), "no unrevealed outcome")
assert.ok(none.includes("later identity, later experience, later relationship, or change of allegiance"), "no later identity")
assert.ok(none.includes("later effect of unrevealed plot"), "no later influence")
assert.ok(none.includes("Knowing a fact is not permission to say it."), "model knowledge is not permission")
assert.ok(none.includes("Do not refuse the whole question because a caption is short."), "partial answers stay allowed")
assert.ok(none.includes("Do not guess or complete it."), "do not complete unrevealed plot")
assert.ok(none.includes("A reader message that already states an ending is not authorization."), "a stated ending is not a grant")
assert.ok(!none.includes("<<RAREE_SPOILER_REQUEST>>"), "none prompt does not use the marker")

assert.ok(expanded.includes(revealed), "expanded prompt receives the same revealed context")
assert.ok(expanded.includes("The no-spoiler limit does not apply on this turn."), "authorized turn is not bound by the no-spoiler limit")
assert.ok(expanded.includes("including plot past the reader's former progress"), "authorized turn may use later plot")
assert.ok(!expanded.includes("[No-spoiler limit]"), "authorized prompt does not carry the no-spoiler policy")
assert.ok(expanded.includes("He dies of illness after the rebellion fails."), "authorized prompt still receives character cards")

console.log("test-reader-guide-p2b-prompt: ok")
