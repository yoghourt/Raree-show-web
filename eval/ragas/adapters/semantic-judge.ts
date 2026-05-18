export type SemanticJudgeInput = {
  question: string
  answer: string
  contexts: string[]
  ground_truth: string
}

export type SemanticJudgeScore = {
  score: number
}

export interface SemanticJudgeAdapter {
  judgeFaithfulness(input: SemanticJudgeInput): Promise<SemanticJudgeScore>
  judgeAnswerRelevancy(input: SemanticJudgeInput): Promise<SemanticJudgeScore>
}
