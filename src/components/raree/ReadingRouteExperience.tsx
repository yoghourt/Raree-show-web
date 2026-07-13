"use client"
/**
 * Reading Route Experience — browser realization of Runtime Reading (RC1).
 *
 * Authority chain (read-only; do not redefine capability here):
 *   SPEC-RDX-001 → Runtime Reading Governance RC1 → W-01 → this component
 *
 * Lifecycle mapping (comments only):
 *   Route entry / FULL_SYNC              → RDX-1 Reading Session Start
 *   Frame reel + caption presentation    → RDX-2 Reader Step Consumption
 *   STEP_* / COMMIT_READING_ROUTE        → RDX-3 Progress Update
 *   Last-frame / route-boundary handlers → RDX-4 Route Completion
 *   Exit / cross-route handoff           → RDX-5 Session Complete
 *
 * Projection boundary: consumes Reading Route + Reading Frames only.
 * SceneProjectionLink / Rollout association reads deferred (RC1).
 * Owner: W-01 (orchestration) + Implementation (presentation).
 */
import { useEffect, useMemo, useRef, useState } from "react"
import type { Character, Location, ReadingRoute } from "@/lib/types"
import { messages as locale } from "@/lib/locale"
import { WESTEROS_MAP_URL } from "@/lib/data"
import { effectiveReadingFramesFromV2, resolvePresentedCaption } from "@/lib/reading-frames"
import { readUpToStoryIndexLastFromStep } from "@/lib/reader-step"
import CaptionDisplay from "@/components/raree/CaptionDisplay"
import ImageReel, { type ImageReelHandle } from "@/components/raree/ImageReel"
import ReadingRouteRopes from "@/components/raree/ReadingRouteRopes"
import MiniMap from "@/components/raree/MiniMap"
import ReadingRouteAssistant from "@/components/raree/ReadingRouteAssistant"
import ReadingRouteTimeCard from "@/components/raree/ReadingRouteTimeCard"
import CharacterCardRack from "@/components/raree/CharacterCardRack"
import ReadingRouteNavButtons from "@/components/raree/ReadingRouteNavButtons"
import HomeButton from "@/components/raree/HomeButton"
import { useReadingRouteNavigation } from "@/components/raree/useReadingRouteNavigation"

const MAP_TRANSITION_MS = 1200

interface ReadingRouteExperienceProps {
  currentReadingRoute: ReadingRoute
  allReadingRoutes: ReadingRoute[]
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

export default function ReadingRouteExperience({
  currentReadingRoute,
  allReadingRoutes,
  characters,
  locations,
  workId,
  workTitle,
}: ReadingRouteExperienceProps) {
  // W-01: Visibility-Synchronized Navigation — docs/specs/w-01-visibility-synchronized-navigation.md
  // imageIndex implements Reader Step index within effective frames (SPEC-RDX-001).
  const { visualReadingRoute, imageIndex, dispatch } = useReadingRouteNavigation(currentReadingRoute)

  const displayedTimeline = workTitle.toUpperCase()
  const [mapError, setMapError] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapImgRef = useRef<HTMLImageElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const imageReelRef = useRef<ImageReelHandle>(null)

  const storyImages = useMemo(
    () => effectiveReadingFramesFromV2(visualReadingRoute.story_images_v2),
    [visualReadingRoute.story_images_v2]
  )

  useEffect(() => {
    setTimeout(() => {
      setMapError(false)
    }, 0)
  }, [visualReadingRoute.id])

  const routeIndex = allReadingRoutes.findIndex((route) => route.id === visualReadingRoute.id)
  const prevRoute = routeIndex > 0 ? allReadingRoutes[routeIndex - 1] : null
  const nextRoute = routeIndex >= 0 && routeIndex < allReadingRoutes.length - 1 ? allReadingRoutes[routeIndex + 1] : null

  const currentLocation = useMemo(
    () => locations.find((location) => location.id === visualReadingRoute.location),
    [locations, visualReadingRoute.location]
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
    return visualReadingRoute.characters_present.map((id) => {
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
  }, [visualReadingRoute.characters_present, characters])

  const sceneAssistantContext = useMemo(
    () => ({
      tsid: visualReadingRoute.tsid,
      workTitle: workTitle.trim() || locale.readingRoute.unnamedWorkFallback,
      title: visualReadingRoute.title,
      chapter_number: visualReadingRoute.chapter_number,
      chapter_title: visualReadingRoute.chapter_title,
      location:
        currentLocation?.name ||
        formatIdToName(visualReadingRoute.location) ||
        locale.readingRoute.unknownLocationFallback,
      characters: presentCharacters.map((p) => p.name),
      summary: visualReadingRoute.summary,
    }),
    [visualReadingRoute, currentLocation, presentCharacters, workTitle]
  )

  // RDX-3 Progress Update — committed boundary for Assistant retrieval (W-01 / ADR-002).
  const sceneAssistantUserProgress = useMemo(
    () => ({
      workTsid: workId,
      readUpToChapter: visualReadingRoute.chapter_number,
      readUpToOrderIndex: visualReadingRoute.order_index ?? visualReadingRoute.order,
      sceneTsid: visualReadingRoute.tsid,
      readUpToStoryIndexLast: readUpToStoryIndexLastFromStep(storyImages.length, imageIndex),
    }),
    [
      workId,
      visualReadingRoute.chapter_number,
      visualReadingRoute.order,
      visualReadingRoute.order_index,
      visualReadingRoute.tsid,
      storyImages.length,
      imageIndex,
    ]
  )

  useEffect(() => {
    const onPopState = () => {
      const parts = window.location.pathname.split("/")
      const sceneId = parts[parts.length - 1]
      const matched = allReadingRoutes.find((s) => s.id === sceneId)
      if (matched) {
        dispatch({ type: "FULL_SYNC", readingRoute: matched, imageIndex: 0 })
      }
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [allReadingRoutes, dispatch])

  function replaceReadingRouteUrl(target: ReadingRoute) {
    window.history.replaceState({}, "", `/works/${workId}/scenes/${target.id}`)
  }

  function navigateReadingRoute(target: ReadingRoute | null) {
    if (!target) return
    dispatch({ type: "COMMIT_READING_ROUTE", readingRoute: target, imageIndex: 0 })
    replaceReadingRouteUrl(target)
  }

  function lastFrameIndexForRoute(route: ReadingRoute): number {
    const frames = effectiveReadingFramesFromV2(route.story_images_v2)
    return frames.length === 0 ? 0 : frames.length - 1
  }

  function handleReelNext() {
    const n = storyImages.length
    if (n === 0) return

    if (n === 1) {
      if (nextRoute) {
        dispatch({ type: "COMMIT_READING_ROUTE", readingRoute: nextRoute, imageIndex: 0 })
        replaceReadingRouteUrl(nextRoute)
      } else {
        tactileOverflowHint()
      }
      return
    }

    if (imageIndex < n - 1) {
      imageReelRef.current?.goNext()
      return
    }

    if (nextRoute) {
      dispatch({ type: "COMMIT_READING_ROUTE", readingRoute: nextRoute, imageIndex: 0 })
      replaceReadingRouteUrl(nextRoute)
    } else {
      tactileOverflowHint()
    }
  }

  function handleReelPrev() {
    const n = storyImages.length
    if (n === 0) return

    if (n === 1) {
      if (prevRoute) {
        const lastIdx = lastFrameIndexForRoute(prevRoute)
        dispatch({ type: "COMMIT_READING_ROUTE", readingRoute: prevRoute, imageIndex: lastIdx })
        replaceReadingRouteUrl(prevRoute)
      } else {
        tactileOverflowHint()
      }
      return
    }

    if (imageIndex > 0) {
      imageReelRef.current?.goPrev()
      return
    }

    if (prevRoute) {
      const lastIdx = lastFrameIndexForRoute(prevRoute)
      dispatch({ type: "COMMIT_READING_ROUTE", readingRoute: prevRoute, imageIndex: lastIdx })
      replaceReadingRouteUrl(prevRoute)
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
            key={`${visualReadingRoute.id}-${imageIndex}`}
            scene={visualReadingRoute}
            caption={resolvePresentedCaption(
              visualReadingRoute.story_images_v2,
              imageIndex
            )}
            currentImageIndex={imageIndex}
            sceneIndex={routeIndex >= 0 ? routeIndex + 1 : 1}
            totalScenes={allReadingRoutes.length}
          />
          <div className="scene-device-base" aria-hidden />
        </div>
      </div>

      <ReadingRouteRopes
        onPrev={handleReelPrev}
        onNext={handleReelNext}
        disabled={storyImages.length === 0}
      />

      <ReadingRouteTimeCard
        workTitle={displayedTimeline}
        scene={{
          id: visualReadingRoute.id,
          title: visualReadingRoute.title,
          chapter_title: visualReadingRoute.chapter_title,
        }}
      />
      <ReadingRouteNavButtons
        onPrev={() => navigateReadingRoute(prevRoute)}
        onNext={() => navigateReadingRoute(nextRoute)}
        prevDisabled={!prevRoute}
        nextDisabled={!nextRoute}
      />
      <div className="rs-scene-right-rail">
        <div className="rs-scene-right-rail-body">
          <div className="rs-scene-right-rail-rack">
            <CharacterCardRack
              sceneId={visualReadingRoute.id}
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
          <ReadingRouteAssistant
            key={visualReadingRoute.tsid}
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
