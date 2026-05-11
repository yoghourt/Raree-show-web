"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import type { Character, Location, Scene } from "@/lib/types"
import { WESTEROS_MAP_URL } from "@/lib/data"
import { effectiveStorySlidesFromV2 } from "@/lib/story-images-v2"
import CaptionDisplay from "@/components/raree/CaptionDisplay"
import ImageReel, { type ImageReelHandle } from "@/components/raree/ImageReel"
import SceneRopes from "@/components/raree/SceneRopes"
import MiniMap from "@/components/raree/MiniMap"
import SceneAssistant from "@/components/raree/SceneAssistant"
import SceneTimeCard from "@/components/raree/SceneTimeCard"
import CharacterCardRack from "@/components/raree/CharacterCardRack"
import SceneNavButtons from "@/components/raree/SceneNavButtons"
import HomeButton from "@/components/raree/HomeButton"
import { useSceneAtomicNavigation } from "@/components/raree/useSceneAtomicNavigation"

const MAP_TRANSITION_MS = 1200

interface SceneExperienceProps {
  currentScene: Scene
  allScenes: Scene[]
  characters: Character[]
  locations: Location[]
  workId: string
  workTitle: string
}

function formatIdToName(raw: string): string {
  return raw
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean)
  return (
    (parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? parts[0]?.[0] ?? "")
  ).toUpperCase() || "?"
}

function tactileOverflowHint() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(12)
  }
}

export default function SceneExperience({
  currentScene,
  allScenes,
  characters,
  locations,
  workId,
  workTitle,
}: SceneExperienceProps) {
  // W-01: Visibility-Synchronized Navigation — docs/specs/w-01-visibility-synchronized-navigation.md
  const { visualScene, imageIndex, dispatch } = useSceneAtomicNavigation(currentScene)

  const displayedTimeline = workTitle.toUpperCase()
  const [mapError, setMapError] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapImgRef = useRef<HTMLImageElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const imageReelRef = useRef<ImageReelHandle>(null)

  const storyImages = useMemo(
    () => effectiveStorySlidesFromV2(visualScene.story_images_v2),
    [visualScene.story_images_v2]
  )

  useEffect(() => {
    setTimeout(() => {
      setMapError(false)
    }, 0)
  }, [visualScene.id])

  const sceneIndex = allScenes.findIndex((scene) => scene.id === visualScene.id)
  const prevScene = sceneIndex > 0 ? allScenes[sceneIndex - 1] : null
  const nextScene = sceneIndex >= 0 && sceneIndex < allScenes.length - 1 ? allScenes[sceneIndex + 1] : null

  const currentLocation = useMemo(
    () => locations.find((location) => location.id === visualScene.location),
    [locations, visualScene.location]
  )

  const mapX = Math.min(1, Math.max(0, currentLocation?.map_focus_x ?? 0.5))
  const mapY = Math.min(1, Math.max(0, currentLocation?.map_focus_y ?? 0.5))

  useEffect(() => {
    const el = mapContainerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setContainerSize({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const presentCharacters = useMemo(() => {
    return visualScene.characters_present.map((id) => {
      const matched = characters.find((character) => character.id === id)
      if (matched) {
        return {
          id,
          name: matched.name,
          initials: getInitials(matched.name),
          image_url: matched.image_url?.trim() ?? "",
          description: matched.description?.trim() ?? "",
        }
      }
      const fallbackName = formatIdToName(id)
      return {
        id,
        name: fallbackName || id,
        initials: (fallbackName || id).charAt(0).toUpperCase() || "?",
        image_url: "",
        description: "",
      }
    })
  }, [visualScene.characters_present, characters])

  const sceneAssistantContext = useMemo(
    () => ({
      tsid: visualScene.tsid,
      workTitle: workTitle.trim() || "未命名作品",
      title: visualScene.title,
      chapter_number: visualScene.chapter_number,
      chapter_title: visualScene.chapter_title,
      location:
        currentLocation?.name ||
        formatIdToName(visualScene.location) ||
        "Unknown",
      characters: presentCharacters.map((p) => p.name),
      summary: visualScene.summary,
    }),
    [visualScene, currentLocation, presentCharacters, workTitle]
  )

  const sceneAssistantUserProgress = useMemo(
    () => ({
      workTsid: workId,
      readUpToChapter: visualScene.chapter_number,
      readUpToOrderIndex: visualScene.order_index ?? visualScene.order,
      sceneTsid: visualScene.tsid,
      readUpToStoryIndexLast: storyImages.length === 0 ? -1 : imageIndex,
    }),
    [
      workId,
      visualScene.chapter_number,
      visualScene.order,
      visualScene.order_index,
      visualScene.tsid,
      storyImages.length,
      imageIndex,
    ]
  )

  useEffect(() => {
    const onPopState = () => {
      const parts = window.location.pathname.split("/")
      const sceneId = parts[parts.length - 1]
      const matched = allScenes.find((s) => s.id === sceneId)
      if (matched) {
        dispatch({ type: "FULL_SYNC", scene: matched, imageIndex: 0 })
      }
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [allScenes, dispatch])

  function replaceSceneUrl(target: Scene) {
    window.history.replaceState({}, "", `/works/${workId}/scenes/${target.id}`)
  }

  function navigateScene(target: Scene | null) {
    if (!target) return
    dispatch({ type: "COMMIT_SCENE", scene: target, imageIndex: 0 })
    replaceSceneUrl(target)
  }

  function lastSlideIndexForScene(scene: Scene): number {
    const slides = effectiveStorySlidesFromV2(scene.story_images_v2)
    return slides.length === 0 ? 0 : slides.length - 1
  }

  function handleReelNext() {
    const n = storyImages.length
    if (n === 0) return

    if (n === 1) {
      if (nextScene) {
        dispatch({ type: "COMMIT_SCENE", scene: nextScene, imageIndex: 0 })
        replaceSceneUrl(nextScene)
      } else {
        tactileOverflowHint()
      }
      return
    }

    if (imageIndex < n - 1) {
      imageReelRef.current?.goNext()
      return
    }

    if (nextScene) {
      dispatch({ type: "COMMIT_SCENE", scene: nextScene, imageIndex: 0 })
      replaceSceneUrl(nextScene)
    } else {
      tactileOverflowHint()
    }
  }

  function handleReelPrev() {
    const n = storyImages.length
    if (n === 0) return

    if (n === 1) {
      if (prevScene) {
        const lastIdx = lastSlideIndexForScene(prevScene)
        dispatch({ type: "COMMIT_SCENE", scene: prevScene, imageIndex: lastIdx })
        replaceSceneUrl(prevScene)
      } else {
        tactileOverflowHint()
      }
      return
    }

    if (imageIndex > 0) {
      imageReelRef.current?.goPrev()
      return
    }

    if (prevScene) {
      const lastIdx = lastSlideIndexForScene(prevScene)
      dispatch({ type: "COMMIT_SCENE", scene: prevScene, imageIndex: lastIdx })
      replaceSceneUrl(prevScene)
    } else {
      tactileOverflowHint()
    }
  }

  return (
    <main
      className="relative h-screen overflow-hidden text-[#2c1810]"
      style={{
        background: "#141210",
      }}
    >
      <div
        ref={mapContainerRef}
        className="absolute inset-0 z-[1] overflow-hidden"
        style={{ backgroundColor: "var(--rs-wood-dark)" }}
      >
        <img
          ref={mapImgRef}
          src={mapError ? "/maps/westeros.jpg" : WESTEROS_MAP_URL}
          alt="Map of Westeros and Essos"
          className="absolute object-cover"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "280%",
            height: "220%",
            objectFit: "cover",
            transform: `translate(${-mapX * 64}%, ${-mapY * 54}%)`,
            transition: `transform ${MAP_TRANSITION_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`,
            visibility: containerSize.width > 0 ? "visible" : "hidden",
          }}
          onError={() => setMapError(true)}
          loading="eager"
          decoding="async"
        />
      </div>

      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.28)",
          pointerEvents: "none",
          zIndex: 5,
        }}
      />
      <div
        className="rs-scene-viewer"
        style={{
          position: "fixed",
          left: "50%",
          top: "48%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        <div className="scene-device-shell">
          <ImageReel
            ref={imageReelRef}
            images={storyImages}
            imageIndex={imageIndex}
            onNext={() => dispatch({ type: "STEP_NEXT" })}
            onPrev={() => dispatch({ type: "STEP_PREV" })}
          />
          <CaptionDisplay
            key={`${visualScene.id}-${imageIndex}`}
            scene={visualScene}
            currentImageIndex={imageIndex}
            sceneIndex={sceneIndex >= 0 ? sceneIndex + 1 : 1}
            totalScenes={allScenes.length}
          />
          <div className="scene-device-base" aria-hidden />
        </div>
      </div>

      <SceneRopes
        onPrev={handleReelPrev}
        onNext={handleReelNext}
        disabled={storyImages.length === 0}
      />

      <SceneTimeCard
        workTitle={displayedTimeline}
        scene={{
          id: visualScene.id,
          chapter_title: visualScene.chapter_title,
        }}
      />
      <SceneNavButtons
        onPrev={() => navigateScene(prevScene)}
        onNext={() => navigateScene(nextScene)}
        prevDisabled={!prevScene}
        nextDisabled={!nextScene}
      />
      <div className="rs-scene-right-rail">
        <div className="rs-scene-right-rail-body">
          <div className="rs-scene-right-rail-rack">
            <CharacterCardRack
              sceneId={visualScene.id}
              characters={presentCharacters.map((item) => ({
                id: item.id,
                name: item.name,
                house: characters.find((c) => c.id === item.id)?.house,
                image_url: item.image_url,
                description: item.description,
              }))}
            />
          </div>
        </div>
        <div className="rs-scene-right-rail-assistant">
          <SceneAssistant
            key={visualScene.tsid}
            sceneContext={sceneAssistantContext}
            userProgress={sceneAssistantUserProgress}
          />
        </div>
      </div>

      <MiniMap
        mapUrl={mapError ? "/maps/westeros.jpg" : WESTEROS_MAP_URL}
        mapX={mapX}
        mapY={mapY}
        locationName={currentLocation?.name}
      />
      <HomeButton />

      <style jsx>{`
        /* 人物列表 + 场景助手同一竖轴，水平居中对齐（与原先各自 fixed right:32 相比，FAB 对齐卡片列中心）
         * Nested scroll: QA Safari when changing this flex chain (rack scroll vs assistant panel inner scroll). */
        .rs-scene-right-rail {
          position: fixed;
          right: 32px;
          bottom: 32px;
          top: calc(28px + env(safe-area-inset-top, 0px));
          z-index: 20;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          width: max-content;
          max-width: calc(100vw - 64px);
          pointer-events: none;
        }

        .rs-scene-right-rail-body {
          flex: 1 1 0;
          min-height: 0;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          width: 100%;
          pointer-events: none;
        }

        .rs-scene-right-rail-rack {
          pointer-events: auto;
          flex: 1 1 0;
          min-height: 0;
          max-height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
        }

        .rs-scene-right-rail-assistant {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          pointer-events: none;
        }

        .rs-scene-right-rail-assistant :global(*) {
          pointer-events: auto;
        }

        .scene-device-shell {
          position: relative;
          display: flex;
          flex-direction: row;
          align-items: stretch;
          gap: 0;
          padding-bottom: 18px;
          animation: rs-breathe-glow 5s ease-in-out infinite;
        }

        .scene-device-base {
          position: absolute;
          left: -4%;
          bottom: 0;
          width: 108%;
          height: 18px;
          margin: 0;
          background: linear-gradient(180deg, #3d2410, #2a1a0e);
          border-radius: 2px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
          pointer-events: none;
          z-index: 4;
        }

      `}</style>
    </main>
  )
}
