"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { Character, Location, Scene } from "@/lib/types"
import CharacterCard from "@/components/raree/CharacterCard"
import LocationCard from "@/components/raree/LocationCard"

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

  useEffect(() => {
    return () => {
      if (swapTimerRef.current) window.clearTimeout(swapTimerRef.current)
      if (endTimerRef.current) window.clearTimeout(endTimerRef.current)
    }
  }, [])

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

  const pills = useMemo(() => {
    return visualScene.characters_present.map((id) => {
      const matched = characters.find((character) => character.id === id)
      if (matched) {
        const parts = matched.name.split(" ").filter(Boolean)
        const initials = (
          (parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? parts[0]?.[0] ?? "")
        ).toUpperCase()
        return { id, name: matched.name, initials: initials || "?" }
      }
      const fallbackName = formatIdToName(id)
      return { id, name: fallbackName || id, initials: (fallbackName || id).charAt(0).toUpperCase() || "?" }
    })
  }, [visualScene.characters_present, characters])

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
      <Image
        src="/maps/westeros.jpg"
        alt="Map of Westeros and Essos"
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 object-cover"
        style={{
          objectPosition: `${mapX}% ${mapY}%`,
          transition: "object-position 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
      <div className="absolute inset-0 bg-[rgba(245,240,232,0.15)]" />

      <div className="absolute z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <span className="scene-marker-ping" />
        <span className="scene-marker-dot" />
      </div>

      <div className="relative z-20 h-full w-full p-6">
        <div className="absolute top-6 left-6 w-[min(760px,calc(100%-4rem))]">
          <p
            key={`timeline-${timelineCycle}`}
            className="text-xs uppercase tracking-[0.25em] text-[#8b1a1a] font-light"
            style={{
              transformOrigin: "center top",
              textShadow: "0 1px 8px rgba(0,0,0,0.8), 0 0 24px rgba(0,0,0,0.6)",
              opacity: phase === "idle" ? 1 : undefined,
              transform: phase === "idle" ? "rotate3d(1,0,0,0deg)" : undefined,
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
          <h1
            className="mt-2 text-3xl font-medium leading-tight text-[#f5f0e8]"
            style={{
              textShadow: "0 1px 8px rgba(0,0,0,0.8), 0 0 24px rgba(0,0,0,0.6)",
            }}
          >
            {visualScene.title}
          </h1>

          <p
            className="mt-6 text-xs uppercase tracking-widest text-[#f5f0e8] font-light"
            style={{
              textShadow: "0 1px 8px rgba(0,0,0,0.8), 0 0 24px rgba(0,0,0,0.6)",
            }}
          >
            Characters Present
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {pills.map((pill, index) => (
              <div
                key={`${visualScene.id}-${pill.id}`}
                className="shrink-0 flex items-center gap-2 border border-[#c8b89a] bg-[rgba(245,240,232,0.85)] rounded-full px-3 py-1.5"
                style={{
                  opacity: phase === "idle" ? 1 : undefined,
                  transform: phase === "idle" ? "translateY(0)" : undefined,
                  animation:
                    phase === "exiting"
                      ? "pillExit 200ms ease-in forwards"
                      : phase === "entering"
                      ? `pillEnter 400ms ease-out ${index * 50}ms forwards`
                      : "none",
                }}
              >
                <span className="h-7 w-7 rounded-full bg-[#8b1a1a]/10 border border-[#8b1a1a]/40 text-[#8b1a1a] text-xs grid place-items-center">
                  {pill.initials}
                </span>
                <span className="text-sm text-[#2c1810]">{pill.name}</span>
              </div>
            ))}
          </div>
        </div>

        <section className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(900px,calc(100%-4rem))] border border-[#c8b89a] bg-[rgba(245,240,232,0.92)] backdrop-blur-sm rounded-xl p-6 text-[#2c1810]">
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

        <Link
          href={`/works/${workId}`}
          className="absolute top-6 right-6 text-xs text-[#f5f0e8] hover:text-[#8b1a1a] transition-colors"
        >
          ← Back to work
        </Link>

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
        @keyframes pillExit {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(-8px);
            opacity: 0;
          }
        }
        @keyframes pillEnter {
          from {
            transform: translateY(12px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </main>
  )
}
