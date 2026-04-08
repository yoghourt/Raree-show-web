"use client"

import { useCallback, useState } from "react"

const PLAQUE_W = 48

export interface SceneRopesProps {
  onPrev: () => void
  onNext: () => void
  disabled?: boolean
}

export default function SceneRopes({ onPrev, onNext, disabled = false }: SceneRopesProps) {
  const [pullLeft, setPullLeft] = useState(false)
  const [pullRight, setPullRight] = useState(false)

  const runPull = useCallback(
    (side: "left" | "right", action: () => void) => {
      if (disabled) return
      if (side === "left") {
        setPullLeft(true)
        window.setTimeout(() => setPullLeft(false), 450)
      } else {
        setPullRight(true)
        window.setTimeout(() => setPullRight(false), 450)
      }
      action()
    },
    [disabled]
  )

  return (
    <>
      <div className="scene-rope scene-rope-left" style={{ left: "calc(50% - 460px - 50px)" }}>
        <button
          type="button"
          className={`scene-rope-hit ${pullLeft ? "scene-rope-pulling" : ""}`}
          aria-label="Previous story image"
          disabled={disabled}
          onClick={() => runPull("left", onPrev)}
        >
          <svg
            className="scene-rope-svg"
            width={40}
            viewBox="0 0 40 400"
            preserveAspectRatio="none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="ropeGradL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3d2410" />
                <stop offset="50%" stopColor="rgba(200, 169, 110, 0.45)" />
                <stop offset="100%" stopColor="#3d2410" />
              </linearGradient>
            </defs>
            <path
              d="M 24 12 Q 9 200 24 360"
              stroke="url(#ropeGradL)"
              strokeWidth={4}
              strokeLinecap="round"
            />
            <ellipse cx="24" cy="8" rx="7" ry="2.5" fill="rgba(0, 0, 0, 0.35)" />
            <circle
              cx="24"
              cy="6"
              r="6"
              stroke="var(--rs-gold)"
              strokeWidth="2"
              fill="var(--rs-wood-dark)"
            />
          </svg>
          <span className="scene-rope-plaque scene-rope-plaque-left">←</span>
        </button>
      </div>

      <div
        className="scene-rope scene-rope-right"
        style={{ left: `calc(50% + 460px + 50px - ${PLAQUE_W}px)` }}
      >
        <button
          type="button"
          className={`scene-rope-hit ${pullRight ? "scene-rope-pulling" : ""}`}
          aria-label="Next story image"
          disabled={disabled}
          onClick={() => runPull("right", onNext)}
        >
          <svg
            className="scene-rope-svg"
            width={40}
            viewBox="0 0 40 400"
            preserveAspectRatio="none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="ropeGradR" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3d2410" />
                <stop offset="50%" stopColor="rgba(200, 169, 110, 0.45)" />
                <stop offset="100%" stopColor="#3d2410" />
              </linearGradient>
            </defs>
            <path
              d="M 16 12 Q 31 200 16 360"
              stroke="url(#ropeGradR)"
              strokeWidth={4}
              strokeLinecap="round"
            />
            <ellipse cx="16" cy="8" rx="7" ry="2.5" fill="rgba(0, 0, 0, 0.35)" />
            <circle
              cx="16"
              cy="6"
              r="6"
              stroke="var(--rs-gold)"
              strokeWidth="2"
              fill="var(--rs-wood-dark)"
            />
          </svg>
          <span className="scene-rope-plaque scene-rope-plaque-right">→</span>
        </button>
      </div>

      <style jsx>{`
        .scene-rope {
          position: fixed;
          top: 0;
          z-index: 11;
          pointer-events: none;
        }

        .scene-rope-hit {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: ${PLAQUE_W}px;
          padding: 0;
          margin: 0;
          border: none;
          background: transparent;
          cursor: grab;
          pointer-events: auto;
          transition: transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .scene-rope-hit:disabled {
          cursor: default;
          opacity: 0.4;
        }

        .scene-rope-svg {
          display: block;
          width: 40px;
          height: 50vh;
          flex-shrink: 0;
          transition: filter 200ms ease;
        }

        .scene-rope-hit:hover:not(:disabled) .scene-rope-svg {
          filter: brightness(1.15);
        }

        .scene-rope-plaque {
          margin-top: 4px;
          width: 48px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid var(--rs-wood-dark);
          background: linear-gradient(135deg, #5a3618, #3d2410);
          color: var(--rs-gold);
          font-size: 20px;
          font-family: Georgia, "Times New Roman", serif;
          line-height: 1;
          border-radius: 2px;
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.6);
          transition: transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .scene-rope-plaque-left {
          transform: rotate(-3deg);
        }

        .scene-rope-plaque-right {
          transform: rotate(3deg);
        }

        .scene-rope-hit:hover:not(:disabled) .scene-rope-plaque {
          transition: transform 200ms ease;
          transform: translateY(-2px) rotate(-3deg);
        }

        .scene-rope-hit:hover:not(:disabled) .scene-rope-plaque-right {
          transition: transform 200ms ease;
          transform: translateY(-2px) rotate(3deg);
        }

        .scene-rope-hit.scene-rope-pulling {
          transition: transform 0ms;
          transform: translateY(10px);
        }

        .scene-rope-hit.scene-rope-pulling .scene-rope-plaque {
          transition: transform 0ms;
        }

        .scene-rope-hit.scene-rope-pulling .scene-rope-plaque-left {
          transform: rotate(-8deg);
        }

        .scene-rope-hit.scene-rope-pulling .scene-rope-plaque-right {
          transform: rotate(8deg);
        }
      `}</style>
    </>
  )
}
