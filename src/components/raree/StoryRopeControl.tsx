"use client"

import { useCallback, useState } from "react"

export interface StoryRopeControlProps {
  onPull: () => void
  disabled?: boolean
}

export default function StoryRopeControl({ onPull, disabled = false }: StoryRopeControlProps) {
  const [handlePulling, setHandlePulling] = useState(false)
  const [straightenRope, setStraightenRope] = useState(false)

  const triggerMotion = useCallback(() => {
    setHandlePulling(true)
    window.setTimeout(() => setHandlePulling(false), 320)
    setStraightenRope(true)
    window.setTimeout(() => setStraightenRope(false), 140)
  }, [])

  const handleClick = useCallback(() => {
    if (disabled) return
    triggerMotion()
    onPull()
  }, [disabled, onPull, triggerMotion])

  return (
    <button
      type="button"
      aria-label="Next story image"
      onClick={handleClick}
      disabled={disabled}
      className="story-rope-control"
      style={{
        position: "fixed",
        bottom: 32,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 15,
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        pointerEvents: "auto",
      }}
    >
      <svg
        width={36}
        height={112}
        viewBox="0 0 36 112"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="story-rope-svg"
      >
        <path
          d="M18 0 C 14 18, 22 36, 18 54 C 14 72, 22 88, 18 92"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          style={{
            opacity: straightenRope ? 0 : 1,
            transition: "opacity 120ms ease-out",
          }}
        />
        <path
          d="M18 0 L 18 92"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          style={{
            opacity: straightenRope ? 1 : 0,
            transition: "opacity 120ms ease-out",
          }}
        />
        <g
          className={
            handlePulling
              ? "story-rope-handle-group story-rope-handle-pulling"
              : "story-rope-handle-group"
          }
        >
          <rect
            x={10}
            y={94}
            width={16}
            height={14}
            rx={3}
            fill="#c8a96e"
            stroke="rgba(0,0,0,0.25)"
            strokeWidth={1}
          />
        </g>
      </svg>
      <style jsx>{`
        .story-rope-handle-group.story-rope-handle-pulling {
          animation: storyRopeHandlePull 300ms forwards;
        }
        @keyframes storyRopeHandlePull {
          0% {
            transform: translateY(0);
            animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
          }
          55% {
            transform: translateY(18px);
            animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
          }
          100% {
            transform: translateY(0);
          }
        }
      `}</style>
    </button>
  )
}
