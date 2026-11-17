import {
  buildAssistantSystemPrompt,
  type AssistantPromptOptions,
  type AssistantSceneContext,
} from "@/lib/assistant-system-prompt"
import { readRequestLocale } from "@/lib/locale/read-request-locale"

/**
 * Locale is read inside this call and passed as a local value.
 * Concurrent requests must not share it.
 */
export async function composeAssistantSystemPrompt(
  sceneContext: AssistantSceneContext,
  currentSceneRevealedXml: string,
  chapterScenesXml: string,
  contextXml: string,
  options: AssistantPromptOptions = {}
): Promise<string> {
  const locale = await readRequestLocale()
  return buildAssistantSystemPrompt(
    sceneContext,
    currentSceneRevealedXml,
    chapterScenesXml,
    contextXml,
    locale,
    options
  )
}
