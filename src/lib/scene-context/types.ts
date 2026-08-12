/**
 * Reader-facing Scene Context subset (IMPLEMENT-SCC-001-L4-B / ADR-012).
 * Storage host may be the Route row; ownership remains Scene Context.
 */

export type SceneContextAppearance = {
  role: string
  name?: string
  visual?: string
  archiveTsid?: string
}

export type SceneContextLocation = {
  environmentFromExpression: string
  archiveTsid?: string
  archiveName?: string
}

/** Minimal fields Reader needs for Step-scoped cast / place. */
export type ReaderSceneContext = {
  contextId: string
  projectsToFrameIndex: number
  characterAppearanceContext: SceneContextAppearance[]
  locationContext: SceneContextLocation
}
