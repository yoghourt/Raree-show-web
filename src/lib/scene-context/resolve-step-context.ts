/**
 * Step → Scene Context bind + Archive join (IMPLEMENT-SCC-001-L4-B).
 * Reader Step index === Context.projectsToFrameIndex.
 */

import type { Character, Location } from "@/lib/types"
import type { ReaderSceneContext } from "@/lib/scene-context/types"

export type StepCastItem = {
  id: string
  name: string
  house?: string
  image_url: string
  description: string
}

export type StepPlace = {
  /** Resolved Archive location when archiveTsid hits; else null. */
  archive: Location | null
  /** Display label for MiniMap / Assistant (may be expression cue). */
  displayName: string
  mapX: number
  mapY: number
}

/** RDX-RS-06: missing Context → null (do not invent Work-wide cast). */
export function resolveContextForStep(
  contexts: ReaderSceneContext[] | undefined | null,
  imageIndex: number
): ReaderSceneContext | null {
  if (!contexts || contexts.length === 0) return null
  if (!Number.isFinite(imageIndex) || imageIndex < 0) return null
  return contexts.find((c) => c.projectsToFrameIndex === imageIndex) ?? null
}

export function resolveStepCast(
  context: ReaderSceneContext | null,
  characters: Character[]
): StepCastItem[] {
  if (!context) return []
  return context.characterAppearanceContext.map((appearance, index) => {
    const archiveId = appearance.archiveTsid?.trim() || ""
    const matched = archiveId
      ? characters.find((c) => c.id === archiveId)
      : undefined
    const name =
      matched?.name?.trim() ||
      appearance.name?.trim() ||
      appearance.role.trim() ||
      `cast-${index}`
    const id = archiveId || `cue:${context.contextId}:${index}:${appearance.role}`
    return {
      id,
      name,
      house: matched?.house,
      image_url: matched?.image_url?.trim() ?? "",
      description: matched?.description?.trim() || appearance.visual?.trim() || "",
    }
  })
}

export function resolveStepPlace(
  context: ReaderSceneContext | null,
  locations: Location[],
  unknownFallback: string
): StepPlace {
  if (!context) {
    return {
      archive: null,
      displayName: unknownFallback,
      mapX: 0.5,
      mapY: 0.5,
    }
  }
  const locCtx = context.locationContext
  const archiveId = locCtx.archiveTsid?.trim() || ""
  const archive = archiveId
    ? locations.find((l) => l.id === archiveId) ?? null
    : null
  const displayName =
    archive?.name?.trim() ||
    locCtx.archiveName?.trim() ||
    locCtx.environmentFromExpression.trim() ||
    unknownFallback
  const mapX = Math.min(1, Math.max(0, archive?.map_focus_x ?? 0.5))
  const mapY = Math.min(1, Math.max(0, archive?.map_focus_y ?? 0.5))
  return { archive, displayName, mapX, mapY }
}

/** Character names for Assistant — same Step Context as the rail. */
export function resolveStepAssistantCharacters(
  context: ReaderSceneContext | null,
  characters: Character[]
): string[] {
  return resolveStepCast(context, characters).map((c) => c.name)
}
