/**
 * P2-A stage-1 gate. Structural checks use fake providers.
 * Run: npx tsx scripts/test-reader-guide-p2a.ts
 */
import assert from "node:assert/strict"
import {
  buildStage1UserContent,
  captionExcerpt,
  decisionEventResponse,
  parseStage1Decision,
  planAfterStage1,
  runStage1Classification,
  type Stage1Caller,
} from "../src/lib/assistant-stage1"
import { signAssistantTurn } from "../src/lib/assistant-turn-seal"
import type { ProviderRuntimeError } from "@/runtime/types"

function caller(id: string, replies: Array<string | Error>): Stage1Caller & { calls: string[] } {
  const calls: string[] = []
  return {
    providerId: id,
    calls,
    async generateText(request) {
      calls.push(request.messages[0]?.content ?? "")
      const next = replies.shift()
      if (next instanceof Error) throw next
      if (next === undefined) throw new Error("no reply")
      return { text: next }
    },
    normalizeError(error: unknown): ProviderRuntimeError {
      const message = error instanceof Error ? error.message : "failed"
      const code = /timeout/i.test(message) ? "timeout" : "provider_unavailable"
      return { code, message }
    },
  }
}

assert.equal(parseStage1Decision('{"decision":"answer_allowed"}')?.decision, "answer_allowed")
assert.equal(parseStage1Decision('{"decision":"uncertain"}')?.decision, "uncertain")
assert.equal(parseStage1Decision('{"decision":"authorization_required"}')?.decision, "authorization_required")
assert.equal(parseStage1Decision('{"decision":"out_of_scope"}')?.decision, "out_of_scope")
assert.equal(parseStage1Decision(""), null)
assert.equal(parseStage1Decision("[]"), null)
assert.equal(parseStage1Decision('{"decision":"answer_allowed","extra":1}'), null)
assert.equal(parseStage1Decision('note {"decision":"answer_allowed"}'), null)
assert.equal(parseStage1Decision('```json\n{"decision":"answer_allowed"}\n```'), null)
assert.equal(parseStage1Decision('{"decision":"maybe"}'), null)

assert.equal(planAfterStage1("answer_allowed"), "stage2")
assert.equal(planAfterStage1("authorization_required"), "authorization")
assert.equal(planAfterStage1("uncertain"), "authorization")
assert.equal(planAfterStage1("out_of_scope"), "out_of_scope")
assert.equal(planAfterStage1("failed"), "error")

const visible = buildStage1UserContent({
  question: "Who is Zhang Jue?",
  history: [],
  captions: ["Zhang Jue leads the Yellow Turban Rebellion."],
  workTitle: "Romance of the Three Kingdoms",
  sceneTitle: "The oath",
})
assert.ok(visible.includes("Zhang Jue leads the Yellow Turban Rebellion."))
assert.equal(visible.includes("later secret fate"), false)

const excerpt = captionExcerpt(
  [
    { text: "Zhang Jue leads the Yellow Turban Rebellion.", current: true },
    { text: "Dong Zhuo enters Luoyang later.", current: false },
  ],
  "Who is Zhang Jue?"
)
assert.ok(excerpt.includes("Zhang Jue"))
assert.ok("Zhang Jue leads the Yellow Turban Rebellion.".includes(excerpt))
assert.equal(excerpt.includes("Dong Zhuo"), false)
assert.equal(captionExcerpt([{ text: "Yellow Turban", current: true }], "张角最后怎么样了？"), "")

async function main() {
  const allowed = caller("gemini", ['{"decision":"answer_allowed"}'])
  const allowedResult = await runStage1Classification({
    primary: allowed,
    system: "classify",
    userContent: "q",
  })
  assert.equal(allowedResult.ok && allowedResult.decision, "answer_allowed")
  assert.deepEqual(allowedResult.calls, ["gemini"])

  const uncertain = caller("gemini", ['{"decision":"uncertain"}'])
  const uncertainResult = await runStage1Classification({ primary: uncertain, system: "classify", userContent: "q" })
  assert.equal(uncertainResult.ok && planAfterStage1(uncertainResult.decision), "authorization")

  const prose = caller("gemini", ["The answer is he dies.", '{"decision":"authorization_required"}'])
  const repaired = await runStage1Classification({ primary: prose, system: "classify", userContent: "q" })
  assert.equal(repaired.ok && repaired.decision, "authorization_required")
  assert.equal(prose.calls.length, 2)

  const broken = caller("gemini", ["nope", "still nope"])
  const fallback = caller("openrouter", ['{"decision":"out_of_scope"}'])
  const fell = await runStage1Classification({
    primary: broken,
    fallback,
    system: "classify",
    userContent: "q",
  })
  assert.equal(fell.ok && fell.decision, "out_of_scope")
  assert.equal(broken.calls.length, 2)
  assert.equal(fallback.calls.length, 1)

  const timed = caller("gemini", [new Error("timeout")])
  const timedResult = await runStage1Classification({ primary: timed, system: "classify", userContent: "q" })
  assert.equal(timedResult.ok, false)
  if (!timedResult.ok) assert.match(timedResult.message, /timed out/i)
  assert.equal(timed.calls.length, 1)

  const dead = caller("gemini", [new Error("timeout")])
  const deadFallback = caller("openrouter", [new Error("unavailable")])
  const allFailed = await runStage1Classification({
    primary: dead,
    fallback: deadFallback,
    system: "classify",
    userContent: "q",
  })
  assert.equal(allFailed.ok, false)

  const seal = signAssistantTurn(
    "k",
    {
      questionId: "q1",
      workTsid: "w",
      sceneTsid: "s",
      kind: "authorization_request",
      spoilerMode: "none",
      expandedRetrieval: false,
      spoilerDisclosure: false,
      spoilerAuthorizationRequest: true,
      readUpToChapter: 1,
      readUpToOrderIndex: 0,
      readUpToStoryIndexLast: 0,
    },
    excerpt
  )
  const response = decisionEventResponse({
    kind: "authorization",
    questionId: "q1",
    visibleText: excerpt,
    seal,
  })
  const body = await response.text()
  const eventAt = body.indexOf("assistant-authorization-required")
  const deltaAt = body.indexOf("text-delta")
  assert.ok(eventAt >= 0)
  assert.equal(deltaAt, -1)
  assert.ok(body.includes(excerpt))
  assert.equal(body.includes("he dies"), false)

  console.log("test-reader-guide-p2a: ok")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
