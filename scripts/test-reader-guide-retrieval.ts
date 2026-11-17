/**
 * Reader Guide P1 retrieval checks against the configured database.
 * Run: npx tsx scripts/test-reader-guide-retrieval.ts
 */
import assert from "node:assert/strict"
import path from "node:path"
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import {
  SceneWorkMismatchError,
  retrieveVerifiedAssistantContext,
} from "../src/services/retrieval"

config({ path: path.resolve(process.cwd(), ".env.local") })

const rotk = "work_1786961407363"
const scene = "scene_1787821760006"
const got = "work_asoiaf"

function captions(verified: Awaited<ReturnType<typeof retrieveVerifiedAssistantContext>>): string {
  return verified.chapterScenes.map((item) => item.revealedStorySlides.map((slide) => slide.caption).join("\n")).join("\n")
}

const early = {
  workTsid: rotk,
  readUpToChapter: 1,
  readUpToOrderIndex: 0,
  sceneTsid: scene,
  readUpToStoryIndexLast: 0,
}

async function main() {
const none = await retrieveVerifiedAssistantContext("张角是怎么发家的？", early, 1, { spoilerMode: "none" })
const noneText = captions(none)
assert.equal(none.contextSummaries.length, 0)
assert.equal(none.promptSummary, "")
assert.equal(noneText.includes("Dong Zhuo"), false)
assert.ok(noneText.length > 0, "empty embedding still leaves the revealed caption")
assert.equal(none.chapterScenes.some((item) => (item.chapter_number ?? 0) > 1), false)

const granted = await retrieveVerifiedAssistantContext("张角最后的下场是什么？", early, 1, {
  spoilerMode: "single_request",
})
const grantedChapters = new Set(granted.chapterScenes.map((item) => item.chapter_number))
assert.ok(grantedChapters.has(3), "authorized path includes a later ingested route")
assert.equal(granted.chapterScenes.every((item) => item.tsid.startsWith("scene_")), true)

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data: foreign } = await supabase.from("scenes").select("tsid").eq("work_id", (
  await supabase.from("works").select("id").eq("tsid", got).single()
).data?.id ?? "").limit(1).maybeSingle()
assert.ok(foreign?.tsid)

await assert.rejects(
  () =>
    retrieveVerifiedAssistantContext("跨作品", { ...early, sceneTsid: foreign.tsid }, 1, {
      spoilerMode: "conversation",
    }),
  (error: unknown) => error instanceof SceneWorkMismatchError
)

console.log("test-reader-guide-retrieval: ok")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
