import { generateText } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { getFetchForGoogleGenerativeAI } from "../../../src/lib/gemini-proxy-fetch"
import { withQuotaRetry } from "./judge-rate-limit"
import type { SemanticJudgeAdapter, SemanticJudgeInput, SemanticJudgeScore } from "./semantic-judge"

const SCORE_JSON_RE = /\{\s*"score"\s*:\s*([0-9]*\.?[0-9]+)\s*\}/

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  const inline = text.match(/\{[\s\S]*\}/)
  if (inline) return inline[0]
  return text.trim()
}

function parseScore(text: string): number {
  const match = text.match(SCORE_JSON_RE)
  if (!match) throw new Error(`Judge response missing score JSON: ${text.slice(0, 200)}`)
  const score = Number.parseFloat(match[1])
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error(`Judge score out of range: ${match[1]}`)
  }
  return score
}

function parseJudgeResponse(text: string): { score: number; reason?: string } {
  const jsonText = extractJsonObject(text)
  const parsed = JSON.parse(jsonText) as { score?: number; reason?: string }
  const score =
    typeof parsed.score === "number" ? parsed.score : parseScore(jsonText)
  return { score, reason: parsed.reason }
}

function debugReason(label: string, reason: string | undefined): void {
  if (process.env.DEBUG_EVAL === "1" && reason) {
    console.debug(`[eval-judge:${label}]`, reason)
  }
}

async function runJudge(
  label: "faithfulness" | "answer_relevancy",
  system: string,
  input: SemanticJudgeInput
): Promise<SemanticJudgeScore> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey?.trim()) {
    throw new Error("GEMINI_API_KEY is required for semantic evaluation")
  }

  const google = createGoogleGenerativeAI({
    apiKey,
    fetch: getFetchForGoogleGenerativeAI(),
  })

  const contextsBlock = input.contexts.map((c, i) => `[context ${i}]\n${c}`).join("\n\n")

  const prompt = `Question: ${input.question}

Retrieved contexts:
${contextsBlock}

Model answer: ${input.answer}

Reference answer (quality baseline only): ${input.ground_truth}

Respond with ONLY a JSON object: {"score": <number between 0 and 1>, "reason": "<brief>"}
Do NOT evaluate spoiler legality or visibility boundaries.`

  const modelId = process.env.EVAL_GEMINI_MODEL?.trim() || "gemini-2.5-flash"

  const { text } = await withQuotaRetry(label, () =>
    generateText({
      model: google(modelId),
      system,
      prompt,
      temperature: 0,
      maxRetries: 0,
    })
  )

  const parsed = parseJudgeResponse(text)
  debugReason(label, parsed.reason)
  return { score: Math.min(1, Math.max(0, parsed.score)) }
}

const FAITHFULNESS_SYSTEM = `You are a semantic faithfulness judge.
Score whether the model answer is supported by the retrieved contexts (0 = unsupported, 1 = fully supported).
Do NOT evaluate spoiler legality, visibility, or whether retrieval was authorized.`

const RELEVANCY_SYSTEM = `You are an answer relevancy judge.
Score whether the model answer addresses the user question (0 = off-topic, 1 = fully addresses).
Do NOT evaluate spoiler legality, visibility, or retrieval boundaries.`

export function createGeminiJudgeAdapter(): SemanticJudgeAdapter {
  return {
    judgeFaithfulness(input) {
      return runJudge("faithfulness", FAITHFULNESS_SYSTEM, input)
    },
    judgeAnswerRelevancy(input) {
      return runJudge("answer_relevancy", RELEVANCY_SYSTEM, input)
    },
  }
}
