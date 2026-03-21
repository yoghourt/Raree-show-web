import { notFound } from "next/navigation"
import {
  getAllCharacters,
  getAllLocations,
  getAllScenes,
  getSceneById,
  getWorkById,
} from "@/lib/data"
import SceneExperience from "../../../../../components/raree/SceneExperience"

interface Props {
  params: Promise<{
    workId: string
    sceneId: string
  }>
}

export default async function ScenePage({ params }: Props) {
  const { workId, sceneId } = await params
  const work = getWorkById(workId)
  if (!work) notFound()

  const scenes = getAllScenes().sort((a, b) => a.order - b.order)
  if (scenes.length === 0) notFound()

  const currentScene = getSceneById(sceneId)
  if (!currentScene) notFound()

  return (
    <SceneExperience
      currentScene={currentScene}
      allScenes={scenes}
      characters={getAllCharacters()}
      locations={getAllLocations()}
      workId={work.id}
    />
  )
}
