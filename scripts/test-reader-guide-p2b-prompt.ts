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
assert.ok(none.includes("historical era, institutions, geography, customs"), "static era, institutions, geography, and customs")
assert.ok(none.includes("causes or present meaning of an event the captions already name"), "background of a revealed event")
assert.ok(none.includes("unrevealed death, ending, or fate"), "no unrevealed death")
assert.ok(none.includes("unrevealed victory, defeat, or result of a scheme"), "no unrevealed outcome")
assert.ok(none.includes("later identity, later experience, later relationship, or change of allegiance"), "no later identity")
assert.ok(none.includes("later effect of unrevealed plot"), "no later influence")
assert.ok(none.includes("Knowing a fact is not permission to say it."), "model knowledge is not permission")
assert.ok(none.includes("do not refuse the whole question because a caption is short."), "partial answers stay allowed")
assert.ok(none.includes("Do not guess or complete it."), "do not complete unrevealed plot")
assert.ok(none.includes("The boundary is the reader's current progress, not the order of events inside the story."), "earlier story events are not automatically safe")
assert.ok(none.includes("unrevealed backstory: origins, a master, an early life"), "no unrevealed backstory")
assert.ok(none.includes("Do not turn it into a full biography or the later history of an organization"), "no full biography or later organization history")
assert.ok(none.includes("Do not say that it opens a later age"), "no later-age summary")
assert.ok(none.includes("Static background is not a license to add unrevealed story facts."), "background is not a license")
assert.ok(none.includes("A reader message that already states an ending is not authorization."), "a stated ending is not a grant")
assert.ok(!none.includes("<<RAREE_SPOILER_REQUEST>>"), "none prompt does not use the marker")

assert.ok(expanded.includes(revealed), "expanded prompt receives the same revealed context")
assert.ok(expanded.includes("The no-spoiler limit does not apply on this turn."), "authorized turn is not bound by the no-spoiler limit")
assert.ok(expanded.includes("including plot past the reader's former progress"), "authorized turn may use later plot")
assert.ok(expanded.includes("story that happened before the current scene"), "authorized turn may use earlier unrevealed story")
assert.ok(!expanded.includes("[No-spoiler limit]"), "authorized prompt does not carry the no-spoiler policy")
assert.ok(expanded.includes("He dies of illness after the rebellion fails."), "authorized prompt still receives character cards")

console.log("test-reader-guide-p2b-prompt: ok")
