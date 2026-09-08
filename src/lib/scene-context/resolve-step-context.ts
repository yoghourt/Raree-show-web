/**
 * Step → Scene Context bind + Archive join (IMPLEMENT-SCC-001-L4-B).
 * Reader Step index === Context.projectsToFrameIndex.
 * IMPLEMENT-WMA-001: map coords fail closed — no (0.5, 0.5) default.
 */

import type { Character, Location } from "@/lib/types"
import type { ReaderSceneContext } from "@/lib/scene-context/types"
import { isValidLocationPin } from "@/lib/work-maps/resolve"

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
  /** Valid pin only; null when missing / unbound / wrong geometry. */
  mapX: number | null
  mapY: number | null
  pinValid: boolean
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
  unknownFallback: string,
  currentGeometryId?: string | null
): StepPlace {
  if (!context) {
    return {
      archive: null,
      displayName: unknownFallback,
      mapX: null,
      mapY: null,
      pinValid: false,
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

  const pinValid = Boolean(
    archive &&
      isValidLocationPin(
        {
          map_focus_x: archive.map_focus_x,
          map_focus_y: archive.map_focus_y,
          map_focus_geometry_id: archive.map_focus_geometry_id,
        },
        currentGeometryId
      )
  )

  return {
    archive,
    displayName,
    mapX: pinValid ? Number(archive!.map_focus_x) : null,
    mapY: pinValid ? Number(archive!.map_focus_y) : null,
    pinValid,
  }
}

/** Character names for Assistant — same Step Context as the rail. */
export function resolveStepAssistantCharacters(
  context: ReaderSceneContext | null,
  characters: Character[]
): string[] {
  return resolveStepCast(context, characters).map((c) => c.name)
}
