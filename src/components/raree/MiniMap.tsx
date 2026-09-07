"use client"

import { useEffect, useRef, useState } from "react"
import { messages as locale } from "@/lib/locale"

export interface MiniMapProps {
  mapUrl: string
  mapX: number
  mapY: number
  locationName?: string
  description?: string
}

export default function MiniMap({
  mapUrl,
  mapX,
  mapY,
  locationName,
  description,
}: MiniMapProps) {
  const px = Math.min(1, Math.max(0, mapX))
  const py = Math.min(1, Math.max(0, mapY))
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const title = locationName?.trim() || locale.location.untitled
  const body = description?.trim() || locale.location.noDescription

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open) {
      el.showModal()
    } else if (el.open) {
      el.close()
    }
  }, [open])

  return (
    <div className="mini-map-root">
      <button
        type="button"
        className="mini-map-hit"
        aria-label={locale.location.viewDetailsAria(title)}
        onClick={() => setOpen(true)}
      >
        <div className="mini-map-frame">
          <img
            src={mapUrl}
            alt=""
            className="mini-map-img"
            style={{
              objectPosition: `${px * 100}% ${py * 100}%`,
            }}
            draggable={false}
          />
          <span className="mini-map-dot" style={{ left: `${px * 100}%`, top: `${py * 100}%` }} />
        </div>
        {locationName ? (
          <p className="mini-map-label" title={locationName}>
            {locationName}
          </p>
        ) : null}
      </button>

      <dialog
        ref={dialogRef}
        className="location-detail-dialog"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            dialogRef.current?.close()
          }
        }}
      >
        <div className="location-detail-inner" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="location-detail-close"
            aria-label={locale.location.closeAria}
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
          <div className="location-detail-body">
            <div className="location-detail-map">
              <img
                src={mapUrl}
                alt=""
                className="location-detail-map-img"
                style={{
                  objectPosition: `${px * 100}% ${py * 100}%`,
                }}
                draggable={false}
              />
              <span
                className="location-detail-dot"
                style={{ left: `${px * 100}%`, top: `${py * 100}%` }}
              />
            </div>
            <div className="location-detail-copy">
              <h2 className="location-detail-title">{title}</h2>
              <p className="location-detail-desc">{body}</p>
            </div>
          </div>
        </div>
      </dialog>

      <style jsx>{`
        .mini-map-root {
          position: fixed;
          bottom: 24px;
          left: 24px;
          z-index: 25;
          width: 180px;
          pointer-events: auto;
        }

        .mini-map-hit {
          display: block;
          width: 100%;
          margin: 0;
          padding: 0;
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: inherit;
          color: inherit;
          font: inherit;
          transition: transform 220ms ease, filter 220ms ease;
        }

        .mini-map-hit:hover {
          transform: translateY(-2px);
          filter: brightness(1.08);
        }

        .mini-map-hit:focus-visible {
          outline: 2px solid var(--rs-gold);
          outline-offset: 3px;
          border-radius: 4px;
        }

        .mini-map-frame {
          position: relative;
          width: 180px;
          height: 120px;
          border: 2px solid var(--rs-wood-mid);
          box-shadow:
            inset 0 0 0 1px var(--rs-gold-dim),
            0 4px 16px rgba(0, 0, 0, 0.6);
          border-radius: 3px;
          overflow: hidden;
        }

        .mini-map-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .mini-map-dot {
          position: absolute;
          transform: translate(-50%, -50%);
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: #8b1a1a;
          box-shadow: 0 0 0 2px rgba(139, 26, 26, 0.4);
          pointer-events: none;
        }

        .mini-map-label {
          margin: 0;
          margin-top: 6px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 14px;
          letter-spacing: 0.15em;
          color: var(--rs-text-dim);
          text-align: center;
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .location-detail-dialog {
          margin: auto;
          max-width: min(960px, calc(100vw - 48px));
          width: 100%;
          border: 1.5px solid var(--rs-wood-mid);
          border-radius: 8px;
          padding: 0;
          background: linear-gradient(180deg, #2a1a0e, #1a100a);
          color: var(--rs-text);
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.75);
        }

        .location-detail-dialog::backdrop {
          background: rgba(0, 0, 0, 0.55);
        }

        .location-detail-inner {
          position: relative;
          padding: 20px 22px 22px;
        }

        .location-detail-close {
          position: absolute;
          top: 14px;
          right: 14px;
          z-index: 2;
          width: 32px;
          height: 32px;
          border: 1px solid var(--rs-gold-dim);
          border-radius: 4px;
          background: rgba(61, 36, 16, 0.6);
          color: var(--rs-text);
          font-size: 1.25rem;
          line-height: 1;
          cursor: pointer;
        }

        .location-detail-close:hover {
          filter: brightness(1.15);
        }

        .location-detail-body {
          display: flex;
          flex-direction: row;
          align-items: stretch;
          gap: 20px;
        }

        .location-detail-map {
          position: relative;
          flex: 0 0 512px;
          width: 512px;
          height: 512px;
          max-width: min(512px, 48vw);
          max-height: min(512px, 70vh);
          border-radius: 4px;
          border: 2px solid var(--rs-gold-dim);
          box-sizing: border-box;
          overflow: hidden;
          background: #0d0705;
        }

        .location-detail-map-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .location-detail-dot {
          position: absolute;
          transform: translate(-50%, -50%);
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: #8b1a1a;
          box-shadow:
            0 0 0 3px rgba(139, 26, 26, 0.35),
            0 0 12px rgba(139, 26, 26, 0.55);
          pointer-events: none;
        }

        .location-detail-copy {
          flex: 1 1 auto;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-right: 28px;
          padding-top: 4px;
        }

        .location-detail-title {
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 1.35rem;
          font-weight: 600;
          color: var(--rs-gold);
          line-height: 1.25;
        }

        .location-detail-desc {
          margin: 0;
          flex: 1 1 auto;
          overflow: auto;
          max-height: min(512px, 70vh);
          font-size: 14px;
          line-height: 1.6;
          color: var(--rs-text);
          white-space: pre-wrap;
        }

        @media (max-width: 640px) {
          .location-detail-body {
            flex-direction: column;
            align-items: center;
          }

          .location-detail-map {
            flex-basis: auto;
            width: min(512px, 100%);
            height: auto;
            aspect-ratio: 1 / 1;
            max-width: 100%;
            max-height: min(512px, 70vh);
          }

          .location-detail-copy {
            width: 100%;
            padding-right: 0;
          }

          .location-detail-desc {
            max-height: min(40vh, 240px);
          }
        }
      `}</style>
    </div>
  )
}
