"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { Character, Location, Scene } from "@/lib/types"
import { WESTEROS_MAP_URL } from "@/lib/data"
import CharacterCard from "@/components/raree/CharacterCard"
import LocationCard from "@/components/raree/LocationCard"
import SceneAssistant from "@/components/raree/SceneAssistant"

interface SceneExperienceProps {
  currentScene: Scene
  allScenes: Scene[]
  characters: Character[]
  locations: Location[]
  workId: string
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
}: SceneExperienceProps) {
  const router = useRouter()
  const swapTimerRef = useRef<number | null>(null)
  const endTimerRef = useRef<number | null>(null)
  const [phase, setPhase] = useState<"idle" | "exiting" | "entering">("idle")
  const [visualScene, setVisualScene] = useState(currentScene)
  const [displayedTimeline, setDisplayedTimeline] = useState(
    currentScene.timeline ?? "Unknown timeline"
  )
  const [timelineCycle, setTimelineCycle] = useState(0)
  const [imageErrorByCharacterId, setImageErrorByCharacterId] = useState<Record<string, boolean>>({})
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    return () => {
      if (swapTimerRef.current) window.clearTimeout(swapTimerRef.current)
      if (endTimerRef.current) window.clearTimeout(endTimerRef.current)
    }
  }, [])

  useEffect(() => {
    // Defer state reset to avoid "cascading render" warnings.
    setTimeout(() => {
      setImageErrorByCharacterId({})
      setMapError(false)
    }, 0)
  }, [visualScene.id])

  const sceneIndex = allScenes.findIndex((scene) => scene.id === visualScene.id)
  const prevScene = sceneIndex > 0 ? allScenes[sceneIndex - 1] : null
  const nextScene = sceneIndex >= 0 && sceneIndex < allScenes.length - 1 ? allScenes[sceneIndex + 1] : null

  const currentPov = useMemo(
    () => characters.find((character) => character.id === visualScene.pov_character),
    [characters, visualScene.pov_character]
  )

  const currentLocation = useMemo(
    () => locations.find((location) => location.id === visualScene.location),
    [locations, visualScene.location]
  )

  const mapX = visualScene.map_focus?.x ?? 50
  const mapY = visualScene.map_focus?.y ?? 50

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
      book: visualScene.book,
      chapter: visualScene.chapter,
      location:
        currentLocation?.name ||
        formatIdToName(visualScene.location) ||
        "Unknown",
      characters: presentCharacters.map((p) => p.name),
      summary: visualScene.summary,
    }),
    [visualScene, currentLocation, presentCharacters]
  )

  function navigateWithAnimation(target: Scene | null, href: string) {
    if (phase !== "idle") return

    setPhase("exiting")
    if (swapTimerRef.current) window.clearTimeout(swapTimerRef.current)
    if (endTimerRef.current) window.clearTimeout(endTimerRef.current)

    swapTimerRef.current = window.setTimeout(() => {
      if (target) {
        setVisualScene(target)
        setDisplayedTimeline(target.timeline ?? "Unknown timeline")
        setTimelineCycle((value) => value + 1)
      }
      setPhase("entering")
    }, 200)

    endTimerRef.current = window.setTimeout(() => {
      setPhase("idle")
      router.push(href)
    }, 600)
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#f5f0e8] text-[#2c1810]">
      <img
        src={mapError ? "/maps/westeros.jpg" : WESTEROS_MAP_URL}
        alt="Map of Westeros and Essos"
        className="absolute inset-0 object-cover"
        style={{
          objectPosition: `${mapX}% ${mapY}%`,
          transition: "object-position 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        onError={() => setMapError(true)}
        loading="eager"
        decoding="async"
      />
      <div className="absolute inset-0 bg-[rgba(245,240,232,0.15)]" />

      <div className="absolute z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <span className="scene-marker-ping" />
        <span className="scene-marker-dot" />
      </div>

      <header
        className="fixed top-0 left-0 right-0 z-30 h-[80px] border-b border-[#c8b89a]"
        style={{
          background: "rgba(245, 240, 232, 0.75)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <Link
          href={`/works/${workId}`}
          className="absolute top-3 right-4 z-10 text-xs text-[#6b4c35] hover:text-[#2c1810] transition-colors"
        >
          ← Back to work
        </Link>

        <div className="flex h-full min-h-0 items-center gap-4 pl-6 pr-28">
          <div className="flex w-[260px] shrink-0 flex-col justify-center gap-1 text-left">
            <p
              key={`timeline-${timelineCycle}`}
              className="text-xs uppercase tracking-[0.25em] text-[#8b1a1a] font-light line-clamp-1"
              style={{
                opacity: phase === "idle" ? 1 : undefined,
                animation:
                  phase === "exiting"
                    ? "timelineExit 200ms ease-in forwards"
                    : phase === "entering"
                    ? "timelineEnter 400ms ease-out forwards"
                    : "none",
              }}
            >
              {displayedTimeline}
            </p>
            <h1 className="text-sm font-medium leading-tight text-[#2c1810] truncate">
              {visualScene.title}
            </h1>
          </div>

          <div
            aria-hidden
            style={{
              width: 1,
              height: 40,
              background: "rgba(139, 26, 26, 0.2)",
              flexShrink: 0,
              alignSelf: "center",
              margin: "0 16px",
            }}
          />

          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden py-1 [scrollbar-width:thin]">
              {presentCharacters.map((item, index) => {
                const hasImage = Boolean(item.image_url) && !imageErrorByCharacterId[item.id]
                return (
                  <div
                    key={`${visualScene.id}-${item.id}`}
                    className="flex w-20 shrink-0 flex-col items-center gap-1"
                    style={{
                      animation:
                        phase === "exiting"
                          ? "topBarCardExit 200ms ease-in forwards"
                          : phase === "entering"
                          ? `topBarCardEnter 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94) ${index * 80}ms both`
                          : "none",
                    }}
                  >
                    {hasImage ? (
                      <img
                        src={item.image_url}
                        alt=""
                        width={44}
                        height={44}
                        className="h-[44px] w-[44px] shrink-0 rounded-full object-cover"
                        onError={() => {
                          setImageErrorByCharacterId((prev) => ({ ...prev, [item.id]: true }))
                        }}
                      />
                    ) : (
                      <div className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full border border-[#8b1a1a]/40 bg-[#8b1a1a]/10 text-[11px] font-medium text-[#8b1a1a]">
                        {item.initials}
                      </div>
                    )}
                    <span className="w-full truncate text-center text-[10px] leading-tight text-[#2c1810]">
                      {item.name}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-20 flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-6 pb-24 pt-4">
        <section className="w-[min(900px,calc(100%-2rem))] border border-[#c8b89a] bg-[rgba(245,240,232,0.92)] backdrop-blur-sm rounded-xl p-6 text-[#2c1810]">
          <p className="text-xs uppercase tracking-widest text-[#8b1a1a] font-light">
            Book {visualScene.book} · Chapter {visualScene.chapter}
          </p>
          <p className="mt-3 text-[#2c1810] leading-relaxed">{visualScene.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {visualScene.tags.map((tag) => (
              <span
                key={`${visualScene.id}-${tag}`}
                className="text-xs px-2 py-1 rounded-full bg-[#c8b89a] text-[#6b4c35]"
              >
                #{tag}
              </span>
            ))}
          </div>

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            {currentPov ? (
              <CharacterCard character={currentPov} />
            ) : (
              <div className="border border-[#c8b89a] rounded-lg p-4 text-sm text-[#6b4c35]">
                POV character data unavailable
              </div>
            )}
            {currentLocation ? (
              <LocationCard location={currentLocation} />
            ) : (
              <div className="border border-[#c8b89a] rounded-lg p-4 bg-[#ede8dc]">
                <p className="text-sm font-medium text-[#2c1810]">
                  {formatIdToName(visualScene.location) || "Unknown Location"}
                </p>
                <p className="text-xs text-[#6b4c35] mt-1">Location details coming soon</p>
              </div>
            )}
          </div>
        </section>

        {prevScene && (
          <button
            type="button"
            onClick={() =>
              navigateWithAnimation(prevScene, `/works/${workId}/scenes/${prevScene.id}`)
            }
            disabled={phase !== "idle"}
            className="absolute left-6 bottom-6 border border-[#8b1a1a] bg-[#8b1a1a] text-[#f5f0e8] px-3 py-1.5 rounded-md text-sm hover:bg-[#6b1414] hover:border-[#6b1414] transition-colors"
          >
            ← prev
          </button>
        )}

        <button
          type="button"
          onClick={() =>
            navigateWithAnimation(
              nextScene,
              nextScene ? `/works/${workId}/scenes/${nextScene.id}` : `/works/${workId}`
            )
          }
          disabled={phase !== "idle"}
          className="absolute right-6 bottom-6 border border-[#8b1a1a] bg-[#8b1a1a] text-[#f5f0e8] px-4 py-2 rounded-md text-sm hover:bg-[#6b1414] hover:border-[#6b1414] transition-colors"
        >
          {nextScene ? "Next scene →" : "← Back to work"}
        </button>
      </div>

      <SceneAssistant sceneContext={sceneAssistantContext} />

      <style jsx>{`
        .scene-marker-ping {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 20px;
          height: 20px;
          border-radius: 9999px;
          background: rgba(139, 26, 26, 0.4);
          animation: markerPing 1.5s ease-out infinite;
        }
        .scene-marker-dot {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: #8b1a1a;
        }
        @keyframes markerPing {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(2.5);
            opacity: 0;
          }
        }
        @keyframes timelineExit {
          from {
            transform: rotate3d(1, 0, 0, 0deg);
            opacity: 1;
          }
          to {
            transform: rotate3d(1, 0, 0, 90deg);
            opacity: 0;
          }
        }
        @keyframes timelineEnter {
          from {
            transform: rotate3d(1, 0, 0, -90deg);
            opacity: 0;
          }
          to {
            transform: rotate3d(1, 0, 0, 0deg);
            opacity: 1;
          }
        }
        @keyframes topBarCardEnter {
          from {
            transform: translateX(100vw);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes topBarCardExit {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(-100vw);
            opacity: 0;
          }
        }
      `}</style>
    </main>
  )
}
