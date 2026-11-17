export type TranslationFieldMap = Partial<
  Record<"title" | "description" | "chapter_title" | "caption" | "name" | "house", string>
>

export type DisplayDictionary = {
  work: Record<string, TranslationFieldMap>
  scene: Record<string, TranslationFieldMap>
  frame: Record<string, TranslationFieldMap>
  character: Record<string, TranslationFieldMap>
  location: Record<string, TranslationFieldMap>
}

export const emptyDisplayDictionary = (): DisplayDictionary => ({
  work: {},
  scene: {},
  frame: {},
  character: {},
  location: {},
})

export type TranslationKind = keyof DisplayDictionary
