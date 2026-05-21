import type { SemanticJudgeAdapter, SemanticJudgeInput } from "../adapters/semantic-judge"

export async function computeFaithfulness(
  judge: SemanticJudgeAdapter,
  input: SemanticJudgeInput
): Promise<number> {
  const { score } = await judge.judgeFaithfulness(input)
  return score
}
