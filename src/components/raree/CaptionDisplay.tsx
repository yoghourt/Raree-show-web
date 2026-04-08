"use client"

import { useEffect, useState } from "react"

export interface CaptionDisplayProps {
  scene: {
    id: string
    chapter_number?: number | null
    chapter_title?: string | null
  }
  caption: string
  imageIndex: number
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
  imageIndex,
  sceneIndex,
  totalScenes,
}: CaptionDisplayProps) {
  const [visibleLength, setVisibleLength] = useState(0)

  useEffect(() => {
    const resetId = window.setTimeout(() => setVisibleLength(0), 0)
    if (caption.length === 0) {
      return () => window.clearTimeout(resetId)
    }

    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setVisibleLength(i)
      if (i >= caption.length) {
        window.clearInterval(id)
      }
    }, 30)

    return () => {
      window.clearTimeout(resetId)
      window.clearInterval(id)
    }
  }, [caption, imageIndex])

  const displayed = caption.slice(0, visibleLength)
  const typingComplete = caption.length === 0 || visibleLength >= caption.length
  const imageRoman = toRomanNumeral(imageIndex + 1)
  const chapterRoman = toRomanNumeral(scene.chapter_number ?? 1)

  useEffect(() => {
    console.log(
      "[CaptionDisplay] scene.chapter_number =",
      scene?.chapter_number,
      "scene.id =",
      scene?.id
    )
  }, [scene?.chapter_number, scene?.id])

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
          {scene.chapter_title ? (
            <p className="caption-chapter-title">{scene.chapter_title}</p>
          ) : (
            <p className="caption-chapter-title caption-chapter-title-empty">—</p>
          )}
          <CompassRoseIcon />
          <p className="caption-scene-progress">
            Scene {sceneIndex} / {totalScenes}
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
            circle at 30% 30%,
            #e5c88a 0%,
            #c8a96e 40%,
            #6b4e2a 100%
          );
          box-shadow:
            inset 0 1px 2px rgba(0, 0, 0, 0.4),
            0 1px 2px rgba(0, 0, 0, 0.6);
          z-index: 5;
          pointer-events: none;
        }

        .rivet.tl {
          top: 14px;
          left: 14px;
        }

        .rivet.tr {
          top: 14px;
          right: 14px;
        }

        .rivet.bl {
          bottom: 14px;
          left: 14px;
        }

        .rivet.br {
          bottom: 14px;
          right: 14px;
        }

        .caption-section-top {
          flex: 0 1 35%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: auto;
        }

        .caption-section-mid {
          flex: 0 0 auto;
          padding: 12px 0;
        }

        .caption-section-bottom {
          flex: 0 1 50%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          text-align: center;
        }

        .caption-display-rule {
          height: 1px;
          width: 100%;
          background: var(--rs-gold-dim);
        }

        .caption-display-rule-top {
          margin-bottom: 10px;
        }

        .caption-display-rule-bottom {
          margin-top: 10px;
        }

        .caption-display-ornament {
          margin: 0;
          text-align: center;
          font-size: 10px;
          line-height: 1;
          color: var(--rs-gold-dim);
        }

        .caption-display-roman {
          margin: 0 0 12px 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 13px;
          letter-spacing: 3px;
          color: var(--rs-gold);
          opacity: 0.7;
          font-weight: 600;
        }

        .caption-display-text {
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 14px;
          line-height: 1.9;
          color: var(--rs-text);
        }

        .caption-chapter-roman {
          margin: 0 0 8px 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 64px;
          line-height: 1;
          color: var(--rs-gold);
          font-weight: 400;
        }

        .caption-chapter-title {
          margin: 0 0 12px 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 11px;
          font-variant: small-caps;
          letter-spacing: 2px;
          color: var(--rs-text-dim);
          max-width: 100%;
        }

        .caption-chapter-title-empty {
          opacity: 0.35;
        }

        .caption-compass-svg {
          display: block;
          margin-bottom: 12px;
          flex-shrink: 0;
        }

        .caption-scene-progress {
          margin: auto 0 0 0;
          padding-top: 8px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 11px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--rs-text-dim);
        }

        .caption-cursor {
          display: inline-block;
          margin-left: 1px;
          animation: captionBlink 1s step-end infinite;
        }

        @keyframes captionBlink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
