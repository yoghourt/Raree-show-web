/**
 * Lenient Reader parse of scenes.scene_contexts_v1 (IMPLEMENT-SCC-001-L4-B).
 * Only appearance / location / frame index are required for consumption.
 */

import type {
  ReaderSceneContext,
  SceneContextAppearance,
  SceneContextLocation,
} from "@/lib/scene-context/types"

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined
}

function parseAppearance(raw: unknown): SceneContextAppearance | null {
  if (!raw || typeof raw !== "object") return null
  const rec = raw as Record<string, unknown>
  const role = asString(rec.role)
  if (!role) return null
  return {
    role,
    ...(asString(rec.name) ? { name: asString(rec.name) } : {}),
    ...(asString(rec.visual) ? { visual: asString(rec.visual) } : {}),
    ...(asString(rec.archiveTsid) ? { archiveTsid: asString(rec.archiveTsid) } : {}),
  }
}

function parseLocation(raw: unknown): SceneContextLocation {
  if (!raw || typeof raw !== "object") {
    return { environmentFromExpression: "" }
  }
  const loc = raw as Record<string, unknown>
  return {
    environmentFromExpression: asString(loc.environmentFromExpression) || "",
    ...(asString(loc.archiveTsid) ? { archiveTsid: asString(loc.archiveTsid) } : {}),
    ...(asString(loc.archiveName) ? { archiveName: asString(loc.archiveName) } : {}),
  }
}

export function parseSceneContextsV1(raw: unknown): ReaderSceneContext[] {
  if (!Array.isArray(raw)) return []
  const out: ReaderSceneContext[] = []

  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const rec = item as Record<string, unknown>
    const contextId = asString(rec.contextId)
    const projectsToFrameIndex = asNumber(rec.projectsToFrameIndex)
    if (!contextId || projectsToFrameIndex === undefined) continue

    const appearancesRaw = Array.isArray(rec.characterAppearanceContext)
      ? rec.characterAppearanceContext
      : []
    const characterAppearanceContext = appearancesRaw
      .map(parseAppearance)
      .filter((a): a is SceneContextAppearance => a != null)

    out.push({
      contextId,
      projectsToFrameIndex,
      characterAppearanceContext,
      locationContext: parseLocation(rec.locationContext),
    })
  }

  return out
}
