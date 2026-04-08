"use client"

import { useCallback, useState } from "react"

interface SceneNavButtonsProps {
  onPrev: () => void
  onNext: () => void
  prevDisabled: boolean
  nextDisabled: boolean
}

export default function SceneNavButtons({
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
}: SceneNavButtonsProps) {
  const [pressed, setPressed] = useState<"left" | "right" | null>(null)

  const handlePress = useCallback((side: "left" | "right", cb: () => void, disabled: boolean) => {
    if (disabled) return
    setPressed(side)
    cb()
    window.setTimeout(() => setPressed(null), 300)
  }, [])

  return (
    <div className="scene-nav-buttons">
      {/* Ropes switch images inside one scene; these buttons switch entire scenes. */}
      <button
        type="button"
        className={`scene-nav-btn ${pressed === "left" ? "pressed" : ""}`}
        onClick={() => handlePress("left", onPrev, prevDisabled)}
        disabled={prevDisabled}
        aria-label="Previous scene"
      >
        <span className="scene-nav-rivet" aria-hidden />
        <span className="scene-nav-glyph" aria-hidden>◀</span>
      </button>
      <button
        type="button"
        className={`scene-nav-btn ${pressed === "right" ? "pressed" : ""}`}
        onClick={() => handlePress("right", onNext, nextDisabled)}
        disabled={nextDisabled}
        aria-label="Next scene"
      >
        <span className="scene-nav-rivet" aria-hidden />
        <span className="scene-nav-glyph" aria-hidden>▶</span>
      </button>

      <style jsx>{`
        .scene-nav-buttons {
          position: fixed;
          left: 32px;
          top: 128px;
          z-index: 8;
          display: flex;
          gap: 12px;
          pointer-events: auto;
        }

        .scene-nav-btn {
          position: relative;
          width: 40px;
          height: 40px;
          border-radius: 999px;
          border: 2px solid var(--rs-wood-mid);
          background: radial-gradient(circle at 30% 30%, #4a2d15, #2a1a0e);
          box-shadow: 0 5px 10px rgba(0, 0, 0, 0.55);
          color: var(--rs-gold);
          font-size: 14px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 250ms ease, filter 250ms ease;
        }

        .scene-nav-btn:hover:not(:disabled) {
          filter: brightness(1.1);
          box-shadow:
            0 4px 8px rgba(0, 0, 0, 0.5),
            0 0 8px var(--rs-gold-dim);
        }

        .scene-nav-btn.pressed {
          transform: translateY(2px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
        }

        .scene-nav-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          filter: grayscale(0.5);
        }

        .scene-nav-rivet {
          position: absolute;
          top: -3px;
          left: 50%;
          transform: translateX(-50%);
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #e5c88a 0%, #c8a96e 40%, #6b4e2a 100%);
          box-shadow:
            inset 0 1px 1px rgba(0, 0, 0, 0.4),
            0 1px 1px rgba(0, 0, 0, 0.5);
        }

        .scene-nav-glyph {
          font-size: 14px;
          line-height: 1;
        }
      `}</style>
    </div>
  )
}

