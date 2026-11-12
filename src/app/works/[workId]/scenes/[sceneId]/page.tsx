/**
 * Reading Route page — Runtime Representation entry for Reader Experience.
 *
 * Authority: SPEC-RDX-001 / Runtime Reading Governance RC1 (raree-show-admin).
 * Projection Complete is an upstream precondition (SPEC-ROL-001 / SPEC-ROL-002).
 * This page consumes Runtime artifacts: `scenes` + `story_images_v2` + `scene_contexts_v1`.
 * Cast / place at Reader Step come from Scene Context (IMPLEMENT-SCC-001-L4-B).
 * SceneProjectionLink / Rollout metadata reads are deferred (RC1) — not performed here.
 *
 * Lifecycle: route URL load → RDX-1 Reading Session Start (realized in ReadingRouteExperience).
 */
import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import {
  getAllCharacters,
  getAllLocations,
  getScenesByWork,
  getWorkById,
} from "@/lib/data"
import { catalogs } from "@/lib/locale/catalog"
import { LOCALE_HEADER, parseLocale } from "@/lib/locale/request"
import { readingDocumentTitle } from "@/lib/locale/title"
import { loadWorkMapResolutionByWorkTsid } from "@/lib/work-maps"
import ReadingRouteExperience from "../../../../../components/raree/ReadingRouteExperience"

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{
    workId: string
    sceneId: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workId, sceneId } = await params
  const headerList = await headers()
  const locale = parseLocale(headerList.get(LOCALE_HEADER))
  const brand = catalogs[locale].meta.title
  const work = await getWorkById(workId)
  const scenes = work ? await getScenesByWork(workId) : []
  const scene = scenes.find((item) => item.id === sceneId)
  const subject = scene?.title?.trim() || work?.title?.trim() || ""
  return { title: { absolute: readingDocumentTitle(subject, brand) } }
}

export default async function ScenePage({ params }: Props) {
  const { workId, sceneId } = await params
  const work = await getWorkById(workId)
  if (!work) notFound()

  const scenes = await getScenesByWork(workId)
  if (scenes.length === 0) notFound()

  const currentScene = scenes.find((s) => s.id === sceneId)
  if (!currentScene) notFound()

  const [characters, locations, workMapResolution] = await Promise.all([
    getAllCharacters(),
    getAllLocations(),
    loadWorkMapResolutionByWorkTsid(work.tsid),
  ])

  return (
    <ReadingRouteExperience
      currentReadingRoute={currentScene}
      allReadingRoutes={scenes}
      characters={characters}
      locations={locations}
      workId={work.id}
      workTitle={work.title}
      workMapResolution={workMapResolution}
    />
  )
}
