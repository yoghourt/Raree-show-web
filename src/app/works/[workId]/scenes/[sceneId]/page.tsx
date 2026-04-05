import { notFound } from "next/navigation"
import {
  getAllCharacters,
  getAllLocations,
  getScenesByWork,
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
  const work = await getWorkById(workId)
  if (!work) notFound()

  const scenes = await getScenesByWork(workId)
  if (scenes.length === 0) notFound()

  const currentScene = scenes.find((s) => s.id === sceneId)
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
