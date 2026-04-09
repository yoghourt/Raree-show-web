"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import type { Character, Location, Scene } from "@/lib/types"
import { WESTEROS_MAP_URL } from "@/lib/data"
import CaptionDisplay from "@/components/raree/CaptionDisplay"
import ImageReel, { type ImageReelHandle } from "@/components/raree/ImageReel"
import SceneRopes from "@/components/raree/SceneRopes"
import MiniMap from "@/components/raree/MiniMap"
import SceneAssistant from "@/components/raree/SceneAssistant"
import SceneTimeCard from "@/components/raree/SceneTimeCard"
import CharacterCardRack from "@/components/raree/CharacterCardRack"
import SceneNavButtons from "@/components/raree/SceneNavButtons"
import HomeButton from "@/components/raree/HomeButton"

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

export default function SceneExperience({
  currentScene,
  allScenes,
  characters,
  locations,
  workId,
  workTitle,
}: SceneExperienceProps) {
  const [visualScene, setVisualScene] = useState(currentScene)
  // TODO: when Work gains a dedicated timeline field, prefer it over title here.
  const displayedTimeline = workTitle.toUpperCase()
  const [mapError, setMapError] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapImgRef = useRef<HTMLImageElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [imageIndex, setImageIndex] = useState(0)
  const imageReelRef = useRef<ImageReelHandle>(null)

  const storyImages = useMemo(() => {
    const v2 = visualScene.story_images_v2
    if (!v2?.length) return []
    return v2
      .map((item) => ({
        url: typeof item.url === "string" ? item.url.trim() : "",
        caption: typeof item.caption === "string" ? item.caption : "",
      }))
      .filter((s) => s.url.length > 0)
  }, [visualScene.story_images_v2])

  useEffect(() => {
    const t = window.setTimeout(() => setImageIndex(0), 0)
    return () => window.clearTimeout(t)
  }, [visualScene.id])

  useEffect(() => {
    setVisualScene(currentScene)
  }, [currentScene])

  useEffect(() => {
    // Defer state reset to avoid "cascading render" warnings.
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
        }
      }
      const fallbackName = formatIdToName(id)
      return {
        id,
        name: fallbackName || id,
        initials: (fallbackName || id).charAt(0).toUpperCase() || "?",
        image_url: "",
      }
    })
  }, [visualScene.characters_present, characters])

  const sceneAssistantContext = useMemo(
    () => ({
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
    [visualScene, currentLocation, presentCharacters]
  )

  useEffect(() => {
    const onPopState = () => {
      const parts = window.location.pathname.split("/")
      const sceneId = parts[parts.length - 1]
      const matched = allScenes.find((s) => s.id === sceneId)
      if (matched) setVisualScene(matched)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [allScenes])

  function navigateScene(target: Scene | null) {
    if (!target) return
    setVisualScene(target)
    window.history.replaceState({}, "", `/works/${workId}/scenes/${target.id}`)
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
            onNext={() =>
              setImageIndex((i) => (storyImages.length > 0 ? (i + 1) % storyImages.length : 0))
            }
            onPrev={() =>
              setImageIndex((i) => {
                const n = storyImages.length
                return n > 0 ? (i - 1 + n) % n : 0
              })
            }
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
        onPrev={() => imageReelRef.current?.goPrev()}
        onNext={() => imageReelRef.current?.goNext()}
        disabled={storyImages.length <= 1}
      />

      <SceneTimeCard
        workTitle={displayedTimeline}
        scene={{
          id: visualScene.id,
          scene_time: visualScene.scene_time,
          chapter_title: visualScene.chapter_title,
          order_index: visualScene.order_index,
          orderIndex: visualScene.orderIndex,
        }}
      />
      <SceneNavButtons
        onPrev={() => navigateScene(prevScene)}
        onNext={() => navigateScene(nextScene)}
        prevDisabled={!prevScene}
        nextDisabled={!nextScene}
      />
      <CharacterCardRack
        sceneId={visualScene.id}
        characters={presentCharacters.map((item) => ({
          id: item.id,
          name: item.name,
          house: characters.find((c) => c.id === item.id)?.house,
          image_url: item.image_url,
        }))}
      />

      <MiniMap
        mapUrl={mapError ? "/maps/westeros.jpg" : WESTEROS_MAP_URL}
        mapX={mapX}
        mapY={mapY}
        locationName={currentLocation?.name}
      />
      <HomeButton />

      <SceneAssistant sceneContext={sceneAssistantContext} />

      <style jsx>{`
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
