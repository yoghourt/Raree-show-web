"use client"

import { useEffect, useState } from "react"
import type { ReadingRoute } from "@/lib/types"
import { messages as locale } from "@/lib/locale"

export interface CaptionDisplayProps {
  scene: ReadingRoute
  /** Caption aligned with ImageReel / effective frame index — never route.summary */
  caption: string
  currentImageIndex: number
  sceneIndex: number
  totalScenes: number
}

function toRomanNumeral(n: number): string {
  if (n < 1) return ""
  const symbols: ReadonlyArray<readonly [number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ]
  let num = n
  let result = ""
  for (const [value, sym] of symbols) {
    while (num >= value) {
      result += sym
      num -= value
    }
  }
  return result
}

function CompassRoseIcon() {
  return (
    <svg
      className="caption-compass-svg"
      width={40}
      height={40}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx={20} cy={20} r={3} stroke="var(--rs-gold)" strokeWidth={1.2} fill="none" />
      <path
        d="M20 4 L22 16 L20 14 L18 16 Z M36 20 L24 22 L26 20 L24 18 Z M20 36 L18 24 L20 26 L22 24 Z M4 20 L16 18 L14 20 L16 22 Z"
        stroke="var(--rs-gold)"
        strokeWidth={1.2}
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export default function CaptionDisplay({
  scene,
  caption,
  currentImageIndex,
  sceneIndex,
  totalScenes,
}: CaptionDisplayProps) {
  const [visibleLength, setVisibleLength] = useState(0)
  const resolvedCaption = caption.trim()
  const chapterTitle = scene.chapter_title?.trim() || ""

  useEffect(() => {
    const resetId = window.setTimeout(() => setVisibleLength(0), 0)
    if (resolvedCaption.length === 0) {
      return () => window.clearTimeout(resetId)
    }

    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setVisibleLength(i)
      if (i >= resolvedCaption.length) {
        window.clearInterval(id)
      }
    }, 18)

    return () => {
      window.clearTimeout(resetId)
      window.clearInterval(id)
    }
  }, [resolvedCaption, currentImageIndex, scene.id])

  const displayed =
    resolvedCaption.length === 0
      ? locale.assistantPrompt.emptyCaption
      : resolvedCaption.slice(0, visibleLength)
  const typingComplete =
    resolvedCaption.length === 0 || visibleLength >= resolvedCaption.length

  const imageRoman = toRomanNumeral(currentImageIndex + 1)
  const chapterRoman = toRomanNumeral(sceneIndex)

  return (
    <div className="caption-display-root">
      <div className="caption-display-panel">
        <span className="rivet tl" aria-hidden />
        <span className="rivet tr" aria-hidden />
        <span className="rivet bl" aria-hidden />
        <span className="rivet br" aria-hidden />
        <div className="caption-section-top">
          <p className="caption-display-roman">{imageRoman}</p>
          <p className="caption-display-text">
            {displayed}
            {!typingComplete && <span className="caption-cursor">|</span>}
          </p>
        </div>

        <div className="caption-section-mid">
          <div className="caption-display-rule caption-display-rule-top" aria-hidden />
          <p className="caption-display-ornament" aria-hidden>
            ✦
          </p>
          <div className="caption-display-rule caption-display-rule-bottom" aria-hidden />
        </div>

        <div className="caption-section-bottom">
          <p className="caption-chapter-roman">{chapterRoman}</p>
          {chapterTitle ? (
            <p className="caption-chapter-title">{chapterTitle}</p>
          ) : null}
          <CompassRoseIcon />
          <p className="caption-scene-progress">
            {locale.readingRoute.routeProgress(sceneIndex, totalScenes)}
          </p>
        </div>
      </div>

      <style jsx>{`
        .caption-display-root {
          position: relative;
          width: 400px;
          height: 82vh;
          pointer-events: auto;
          z-index: 2;
          box-sizing: border-box;
          align-self: flex-start;
          display: flex;
          flex-direction: column;
        }

        .caption-display-panel {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          position: relative;
          border: 5px solid transparent;
          border-radius: 4px;
          background:
            linear-gradient(
                160deg,
                rgba(42, 26, 14, 0.88) 0%,
                rgba(20, 10, 5, 0.88) 100%
              )
              padding-box,
            linear-gradient(135deg, #3d2410 0%, #2a1a0e 50%, #3d2410 100%) border-box;
          background-clip: padding-box, border-box;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          box-shadow:
            0 30px 60px rgba(0, 0, 0, 0.7),
            0 10px 20px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(200, 169, 110, 0.15);
          padding: 20px 22px;
          box-sizing: border-box;
          overflow: visible;
        }

        .rivet {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: radial-gradient(
            circle at 35% 35%,
            #e8d5a3 0%,
            #c8a96e 45%,
            #8a6a30 100%
          );
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
          z-index: 3;
        }
        .rivet.tl {
          top: 8px;
          left: 8px;
        }
        .rivet.tr {
          top: 8px;
          right: 8px;
        }
        .rivet.bl {
          bottom: 8px;
          left: 8px;
        }
        .rivet.br {
          bottom: 8px;
          right: 8px;
        }

        .caption-section-top {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow: auto;
        }

        .caption-section-mid {
          flex-shrink: 0;
          padding: 12px 0;
        }

        .caption-section-bottom {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding-top: 4px;
        }

        .caption-display-rule {
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(200, 169, 110, 0.45),
            transparent
          );
        }
        .caption-display-rule-top {
          margin-bottom: 8px;
        }
        .caption-display-rule-bottom {
          margin-top: 8px;
        }
        .caption-display-ornament {
          text-align: center;
          color: var(--rs-gold);
          font-size: 12px;
          letter-spacing: 0.2em;
        }

        .caption-display-roman {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 11px;
          letter-spacing: 0.28em;
          color: var(--rs-gold-dim);
          margin: 0;
        }

        .caption-display-text {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 15px;
          line-height: 1.65;
          color: rgba(245, 230, 200, 0.92);
          margin: 0;
          white-space: pre-wrap;
        }

        .caption-chapter-roman {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
          letter-spacing: 0.28em;
          color: var(--rs-gold-dim);
          margin: 0;
        }

        .caption-chapter-title {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 16px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--rs-gold);
          margin: 0;
          text-align: center;
        }

        .caption-chapter-title-empty {
          opacity: 0.5;
        }

        .caption-chapter-subtitle {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 12px;
          letter-spacing: 0.06em;
          color: var(--rs-gold-dim);
          margin: 0;
          text-align: center;
        }

        .caption-compass-svg {
          margin: 4px 0;
        }

        .caption-scene-progress {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 11px;
          letter-spacing: 0.12em;
          color: var(--rs-gold-dim);
          margin: 0;
        }

        .caption-cursor {
          margin-left: 1px;
          color: var(--rs-gold);
          animation: captionBlink 1s step-end infinite;
        }
        @keyframes captionBlink {
          50% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
