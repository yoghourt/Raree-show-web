"use client"

import { useEffect, useRef, useState } from "react"

interface SceneTimeCardProps {
  workTitle: string
  scene: {
    id: string
    scene_time?: string | null
    sceneTime?: string | null
    chapter_title?: string | null
    chapterTitle?: string | null
    order_index?: number | null
    orderIndex?: number | null
  }
}

function getDisplayTime(scene: SceneTimeCardProps["scene"]): string {
  const orderIndex = scene.order_index ?? scene.orderIndex
  return (
    (scene.scene_time && String(scene.scene_time).trim()) ||
    (scene.sceneTime && String(scene.sceneTime).trim()) ||
    (scene.chapter_title && String(scene.chapter_title).trim()) ||
    (scene.chapterTitle && String(scene.chapterTitle).trim()) ||
    (orderIndex && orderIndex > 0 ? `Scene ${orderIndex}` : "Untitled Scene")
  )
}

export default function SceneTimeCard({ workTitle, scene }: SceneTimeCardProps) {
  const sceneId = scene.id
  const sceneTimeText = getDisplayTime(scene)
  const prevSceneIdRef = useRef(sceneId)
  const [currentText, setCurrentText] = useState(sceneTimeText)
  const [outgoingText, setOutgoingText] = useState<string | null>(null)
  const [incomingText, setIncomingText] = useState<string | null>(null)
  const [phase, setPhase] = useState<"idle" | "out" | "in">("idle")

  // Debug current scene payload for field-name mismatch.
  console.log("[SceneTimeCard] scene =", JSON.stringify(scene, null, 2))

  useEffect(() => {
    if (prevSceneIdRef.current === sceneId && currentText === sceneTimeText) return
    prevSceneIdRef.current = sceneId

    const t0 = window.setTimeout(() => {
      setOutgoingText(currentText)
      setIncomingText(sceneTimeText)
      setPhase("out")
    }, 0)

    const t1 = window.setTimeout(() => setPhase("in"), 300)
    const t2 = window.setTimeout(() => {
      setCurrentText(sceneTimeText)
      setOutgoingText(null)
      setIncomingText(null)
      setPhase("idle")
    }, 600)

    return () => {
      window.clearTimeout(t0)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [sceneId, sceneTimeText, currentText])

  return (
    <div className="scene-time-card">
      <span className="rivet tl" aria-hidden />
      <span className="rivet tr" aria-hidden />
      <span className="rivet bl" aria-hidden />
      <span className="rivet br" aria-hidden />

      <p className="scene-time-work-title">{workTitle.toUpperCase()}</p>
      <div className="scene-time-flip-stage" aria-live="polite">
        {phase === "idle" ? (
          <span className="scene-time-current">{currentText}</span>
        ) : (
          <>
            <span className={`scene-time-layer scene-time-out ${phase}`}>
              {outgoingText ?? currentText}
            </span>
            <span className={`scene-time-layer scene-time-in ${phase}`}>
              {incomingText ?? sceneTimeText}
            </span>
          </>
        )}
      </div>

      <style jsx>{`
        .scene-time-card {
          position: fixed;
          top: 28px;
          left: 32px;
          width: 200px;
          min-height: 90px;
          border: 2px solid var(--rs-wood-mid);
          background: linear-gradient(135deg, #3d2410, #2a1a0e);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
          border-radius: 3px;
          padding: 14px 18px;
          box-sizing: border-box;
          z-index: 8;
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

        .scene-time-work-title {
          margin: 0;
          color: var(--rs-gold-dim);
          font-size: 11px;
          letter-spacing: 2.5px;
          font-family: Georgia, "Times New Roman", serif;
          line-height: 1.2;
        }

        .scene-time-flip-stage {
          position: relative;
          margin-top: 10px;
          min-height: 30px;
          perspective: 600px;
        }

        .scene-time-current,
        .scene-time-layer {
          display: block;
          color: var(--rs-text);
          font-size: 22px;
          font-family: Georgia, "Times New Roman", serif;
          font-weight: 500;
          line-height: 1.2;
          transform-origin: 50% 50%;
          backface-visibility: hidden;
        }

        .scene-time-layer {
          position: absolute;
          left: 0;
          right: 0;
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

