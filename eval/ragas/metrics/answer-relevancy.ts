import type { SemanticJudgeAdapter, SemanticJudgeInput } from "../adapters/semantic-judge"

export async function computeAnswerRelevancy(
  judge: SemanticJudgeAdapter,
  input: SemanticJudgeInput
): Promise<number> {
  const { score } = await judge.judgeAnswerRelevancy(input)
  return score
}
