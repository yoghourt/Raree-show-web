"use client"

import { useEffect, useRef, useState } from "react"

interface ReadingRouteTimeCardProps {
  workTitle: string
  scene: {
    id: string
    title?: string | null
    chapter_title?: string | null
    chapterTitle?: string | null
  }
}

// Primary plaque text = Reading Route title (admin「标题」); chapter_title as secondary fallback.
function getRouteTitleText(scene: ReadingRouteTimeCardProps["scene"]): string {
  const title = String(scene.title ?? "").trim()
  if (title) return title
  return String(scene.chapter_title ?? scene.chapterTitle ?? "").trim()
}

export default function ReadingRouteTimeCard({ workTitle, scene }: ReadingRouteTimeCardProps) {
  const sceneId = scene.id
  const chapterTitleText = getRouteTitleText(scene)
  const prevSceneIdRef = useRef(sceneId)
  const [currentText, setCurrentText] = useState(chapterTitleText)
  const [outgoingText, setOutgoingText] = useState<string | null>(null)
  const [incomingText, setIncomingText] = useState<string | null>(null)
  const [phase, setPhase] = useState<"idle" | "out" | "in">("idle")

  useEffect(() => {
    if (prevSceneIdRef.current === sceneId && currentText === chapterTitleText) return
    prevSceneIdRef.current = sceneId

    const t0 = window.setTimeout(() => {
      setOutgoingText(currentText)
      setIncomingText(chapterTitleText)
      setPhase("out")
    }, 0)

    const t1 = window.setTimeout(() => setPhase("in"), 300)
    const t2 = window.setTimeout(() => {
      setCurrentText(chapterTitleText)
      setOutgoingText(null)
      setIncomingText(null)
      setPhase("idle")
    }, 600)

    return () => {
      window.clearTimeout(t0)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [sceneId, chapterTitleText, currentText])

  const widthText = [currentText, outgoingText, incomingText, chapterTitleText]
    .filter((t): t is string => Boolean(t && t.trim()))
    .reduce((longest, next) => (next.length > longest.length ? next : longest), currentText || " ")

  return (
    <div className="scene-time-sign">
      <div className="scene-time-lintel" aria-hidden>
        <span className="scene-time-lintel-bolt left" />
        <span className="scene-time-lintel-bolt right" />
      </div>
      <div className="scene-time-brackets" aria-hidden>
        <span className="scene-time-bracket" />
        <span className="scene-time-bracket" />
      </div>
      <div className="scene-time-card">
        <span className="rivet bl" aria-hidden />
        <span className="rivet br" aria-hidden />

        <p className="scene-time-work-title">{workTitle.toUpperCase()}</p>
        <div className="scene-time-flip-stage" aria-live="polite">
          <span className="scene-time-sizer" aria-hidden>
            {widthText}
          </span>
          {phase === "idle" ? (
            <span className="scene-time-current">{currentText}</span>
          ) : (
            <>
              <span className={`scene-time-layer scene-time-out ${phase}`}>
                {outgoingText ?? currentText}
              </span>
              <span className={`scene-time-layer scene-time-in ${phase}`}>
                {incomingText ?? chapterTitleText}
              </span>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .scene-time-sign {
          position: fixed;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: max-content;
          max-width: calc(100vw - 64px);
          pointer-events: none;
        }

        .scene-time-lintel {
          position: relative;
          width: calc(100% + 28px);
          height: 14px;
          background: linear-gradient(180deg, #4a2d15 0%, #2a1a0e 55%, #1a100a 100%);
          border: 2px solid var(--rs-wood-mid);
          border-top: none;
          border-radius: 0 0 2px 2px;
          box-shadow:
            0 4px 10px rgba(0, 0, 0, 0.45),
            inset 0 1px 0 rgba(200, 169, 110, 0.2);
          box-sizing: border-box;
        }

        .scene-time-lintel-bolt {
          position: absolute;
          top: 50%;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          transform: translateY(-50%);
          background: radial-gradient(circle at 30% 30%, #e5c88a 0%, #c8a96e 40%, #6b4e2a 100%);
          box-shadow:
            inset 0 1px 1px rgba(0, 0, 0, 0.35),
            0 1px 1px rgba(0, 0, 0, 0.5);
        }

        .scene-time-lintel-bolt.left {
          left: 10px;
        }

        .scene-time-lintel-bolt.right {
          right: 10px;
        }

        .scene-time-brackets {
          display: flex;
          justify-content: space-between;
          width: calc(100% - 36px);
          max-width: 100%;
          height: 16px;
          margin-top: -2px;
          pointer-events: none;
        }

        .scene-time-bracket {
          width: 6px;
          height: 100%;
          background: linear-gradient(90deg, #3d2410, #c8a96e 45%, #3d2410);
          border-radius: 0 0 1px 1px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        }

        .scene-time-card {
          position: relative;
          width: max-content;
          max-width: 100%;
          min-height: 78px;
          margin-top: -2px;
          border: 2px solid var(--rs-wood-mid);
          border-top-color: rgba(200, 169, 110, 0.35);
          background: linear-gradient(180deg, #3d2410 0%, #2a1a0e 100%);
          box-shadow:
            0 10px 22px rgba(0, 0, 0, 0.55),
            inset 0 1px 0 rgba(200, 169, 110, 0.12);
          border-radius: 0 0 4px 4px;
          padding: 12px 22px 14px;
          box-sizing: border-box;
          overflow: hidden;
          text-align: center;
          pointer-events: auto;
        }

        .rivet {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #e5c88a 0%, #c8a96e 40%, #6b4e2a 100%);
          box-shadow:
            inset 0 1px 2px rgba(0, 0, 0, 0.4),
            0 1px 2px rgba(0, 0, 0, 0.6);
          z-index: 1;
          pointer-events: none;
        }

        .rivet.bl {
          bottom: 8px;
          left: 8px;
        }
        .rivet.br {
          bottom: 8px;
          right: 8px;
        }

        .scene-time-work-title {
          margin: 0;
          color: var(--rs-gold-dim);
          font-size: 14px;
          letter-spacing: 2.5px;
          font-family: Georgia, "Times New Roman", serif;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          text-align: center;
        }

        .scene-time-flip-stage {
          position: relative;
          margin-top: 8px;
          min-height: 30px;
          width: max-content;
          max-width: 100%;
          margin-left: auto;
          margin-right: auto;
          perspective: 600px;
        }

        .scene-time-sizer {
          display: block;
          visibility: hidden;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          font-size: 22px;
          font-family: Georgia, "Times New Roman", serif;
          font-weight: 500;
          line-height: 1.2;
          pointer-events: none;
        }

        .scene-time-current,
        .scene-time-layer {
          display: block;
          color: var(--rs-text);
          font-size: 22px;
          font-family: Georgia, "Times New Roman", serif;
          font-weight: 500;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          transform-origin: 50% 50%;
          backface-visibility: hidden;
        }

        .scene-time-current {
          position: absolute;
          left: 0;
          top: 0;
        }

        .scene-time-layer {
          position: absolute;
          left: 0;
          top: 0;
        }

        .scene-time-out.out {
          animation: sceneTimeOut 300ms ease-in-out forwards;
        }
        .scene-time-out.in {
          opacity: 0;
        }

        .scene-time-in.out {
          opacity: 0;
          transform: rotateX(90deg);
        }
        .scene-time-in.in {
          animation: sceneTimeIn 300ms ease-in-out forwards;
        }

        @keyframes sceneTimeOut {
          from {
            transform: rotateX(0deg);
            opacity: 1;
          }
          to {
            transform: rotateX(-90deg);
            opacity: 0;
          }
        }

        @keyframes sceneTimeIn {
          from {
            transform: rotateX(90deg);
            opacity: 0;
          }
          to {
            transform: rotateX(0deg);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
