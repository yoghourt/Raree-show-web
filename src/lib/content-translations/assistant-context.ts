export type CanonicalSceneAssistantContext = {
  tsid: string
  workTitle: string
  title: string
  chapter_number: number
  chapter_title: string | null
  location: string
  characters: string[]
  summary: string
}

/** Assistant context is built only from canonical English fields. */
export function canonicalSceneAssistantContext(input: {
  tsid: string
  workTitle: string
  title: string
  chapter_number: number
  chapter_title: string | null
  location: string
  characters: string[]
  summary: string
  unnamedWorkFallback: string
}): CanonicalSceneAssistantContext {
  return {
    tsid: input.tsid,
    workTitle: input.workTitle.trim() || input.unnamedWorkFallback,
    title: input.title,
    chapter_number: input.chapter_number,
    chapter_title: input.chapter_title,
    location: input.location,
    characters: input.characters,
    summary: input.summary,
  }
}
