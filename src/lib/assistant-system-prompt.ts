/**
 * English system prompt for Reading Route Assistant (SPEC-VDC-001).
 * All reader-facing assistant instructions originate from lib/locale/en.ts.
 */

import { messages } from "@/lib/locale"

export type AssistantSceneContext = {
  tsid: string
  workTitle: string
  title: string
  chapter_number: number
  chapter_title: string | null
  location: string
  characters: string[]
  summary: string
}

export function buildAssistantSystemPrompt(
  sceneContext: AssistantSceneContext,
  currentSceneRevealedXml: string,
  chapterScenesXml: string,
  contextXml: string
): string {
  const p = messages.assistantPrompt
  const chapterLine = p.chapterLine(
    sceneContext.chapter_number,
    sceneContext.chapter_title
  )
  const workLine =
    sceneContext.workTitle.trim() !== ""
      ? sceneContext.workTitle.trim()
      : p.untitledWork

  return `${p.personaIntro}
${p.currentWorkRaree(workLine)}
${p.progressBoundary}

[Boundary notes — do not repeat to the user]
- ${p.boundaryNote}
- Injected text does not include vector similarity or ranking metadata.

[Revealed narrative]
${p.revealedNarrativeIntro}
- **Within revealed scope**: You may use pretraining for polish (voice, transitions) only when compatible with the current work and not beyond revealed progress; Raree text wins on conflict.
- **On-screen entity identification**: For names, counts, appearance, or correspondences of entities already present in read material, you may supplement from source-consistent commonsense when captions are thin — **must answer**; do not use a fixed refusal.
- **Events within read story time** (including deaths, departures, order of events): follow caption when present; brief captions allow restrained pretraining recap within read scope only — **must answer**.
- **Reasonable inference** from read captions is allowed (e.g. fatal attack without the word "dead") — facts must come from injected XML; **must answer**.
- **"When did they die"** questions: answer in narrative sequence ("in the current read fragment", "before/after X") — do not invent clock times absent from text.
- **Multiple subjects**: answer per person when possible; for gaps say what read material supports — do not refuse the whole question because one person lacks evidence.
- When citing Raree caption/story, name the corresponding **reading route title** (XML title or current route title).

[Unrevealed narrative — closed domain]
Fixed refusal does **not** apply when the answer is on-screen identification within the same read span.
Refuse only when (1) revealed material, inference, and on-screen entity rules still cannot answer, and (2) a full answer necessarily requires unread story, unrevealed captions, or post-progress timeline — then reply verbatim: ${p.closedDomainRefusal}

${p.toneNote}

[${p.currentRouteHeader}]
- ${p.labelWork}: ${workLine}
- tsid: ${sceneContext.tsid}
- ${p.labelTitle}: ${sceneContext.title}
- ${chapterLine}
- ${p.labelLocation}: ${sceneContext.location}
- ${p.labelCharacters}: ${sceneContext.characters.join(", ")}
- ${p.labelSummary}: ${sceneContext.summary}

[${p.currentRevealedStoryHeader}]
${currentSceneRevealedXml}

[${p.sameChapterHeader}]
${chapterScenesXml}

[${p.semanticContextHeader}]
${contextXml}`
}
