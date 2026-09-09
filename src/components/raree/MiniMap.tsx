"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react"
import { messages as locale } from "@/lib/locale"
import {
  clampView,
  closeUpMapView,
  DETAIL_MAP_COVER_MULTIPLIER,
  fitScale,
  MAP_TRANSITION_EASING,
  MAP_TRANSITION_MS,
  maxScale as maxScaleFor,
  pinScreenPosition,
  zoomAt,
  type MapView,
} from "@/lib/map-viewport"

export interface MiniMapProps {
  mapUrl: string
  mapX: number
  mapY: number
  locationName?: string
  description?: string
}

type Size = { width: number; height: number }
type Nat = { w: number; h: number }

function LocationMapViewport({
  mapUrl,
  px,
  py,
}: {
  mapUrl: string
  px: number
  py: number
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<MapView | null>(null)
  const epochRef = useRef("")
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null)
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null)

  const [nat, setNat] = useState<Nat | null>(null)
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 })
  const [view, setView] = useState<MapView | null>(null)
  const [dragging, setDragging] = useState(false)

  viewRef.current = view

  const imgRef = useRef<HTMLImageElement>(null)

  const applyView = useCallback((next: MapView) => {
    viewRef.current = next
    setView(next)
  }, [])

  const applyNaturalSize = useCallback((img: HTMLImageElement) => {
    if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return
    setNat((prev) =>
      prev?.w === img.naturalWidth && prev.h === img.naturalHeight
        ? prev
        : { w: img.naturalWidth, h: img.naturalHeight }
    )
  }, [])

  useEffect(() => {
    epochRef.current = ""
    setView(null)
    setNat(null)
    const img = imgRef.current
    if (img?.complete) applyNaturalSize(img)
  }, [applyNaturalSize, mapUrl])

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setViewport((prev) =>
        prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height }
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const vw = viewport.width
    const vh = viewport.height
    if (!nat || vw <= 0 || vh <= 0) return
    const epoch = `${mapUrl}:${px}:${py}:${nat.w}:${nat.h}`
    if (epochRef.current !== epoch) {
      epochRef.current = epoch
      applyView(
        closeUpMapView(
          px,
          py,
          nat.w,
          nat.h,
          vw,
          vh,
          DETAIL_MAP_COVER_MULTIPLIER
        )
      )
      return
    }
    const current = viewRef.current
    if (current) {
      applyView(clampView(current, nat.w, nat.h, vw, vh))
    }
  }, [applyView, mapUrl, nat, px, py, viewport.height, viewport.width])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const current = viewRef.current
      const size = nat
      if (!current || !size) return
      const vw = el.clientWidth
      const vh = el.clientHeight
      if (vw <= 0 || vh <= 0) return
      const rect = el.getBoundingClientRect()
      const minS = fitScale(size.w, size.h, vw, vh)
      const maxS = maxScaleFor(size.w, size.h, vw, vh)
      const delta =
        event.deltaMode === 1
          ? event.deltaY * 16
          : event.deltaMode === 2
            ? event.deltaY * vh
            : event.deltaY
      const factor = Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.0025))
      applyView(
        zoomAt(
          current,
          current.scale * factor,
          event.clientX - rect.left,
          event.clientY - rect.top,
          size.w,
          size.h,
          vw,
          vh,
          minS,
          maxS
        )
      )
    }

    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [applyView, nat])

  const pinchZoom = (el: HTMLDivElement) => {
    const current = viewRef.current
    const size = nat
    if (!current || !size) return
    const pts = [...pointersRef.current.values()]
    if (pts.length !== 2) return
    const [a, b] = pts
    const distance = Math.hypot(a.x - b.x, a.y - b.y)
    if (distance < 1) return
    if (!pinchRef.current) {
      pinchRef.current = { distance, scale: current.scale }
      return
    }
    const vw = el.clientWidth
    const vh = el.clientHeight
    const rect = el.getBoundingClientRect()
    const originX = (a.x + b.x) / 2 - rect.left
    const originY = (a.y + b.y) / 2 - rect.top
    const minS = fitScale(size.w, size.h, vw, vh)
    const maxS = maxScaleFor(size.w, size.h, vw, vh)
    applyView(
      zoomAt(
        current,
        pinchRef.current.scale * (distance / pinchRef.current.distance),
        originX,
        originY,
        size.w,
        size.h,
        vw,
        vh,
        minS,
        maxS
      )
    )
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointersRef.current.size >= 2) {
      dragRef.current = null
      setDragging(false)
      pinchRef.current = null
      return
    }
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    setDragging(true)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointersRef.current.size >= 2) {
      pinchZoom(event.currentTarget)
      return
    }
    const drag = dragRef.current
    const current = viewRef.current
    const size = nat
    if (!drag || drag.id !== event.pointerId || !current || !size) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    drag.x = event.clientX
    drag.y = event.clientY
    applyView(
      clampView(
        { scale: current.scale, x: current.x + dx, y: current.y + dy },
        size.w,
        size.h,
        event.currentTarget.clientWidth,
        event.currentTarget.clientHeight
      )
    )
  }

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId)
    if (dragRef.current?.id === event.pointerId) {
      dragRef.current = null
    }
    pinchRef.current = null
    if (pointersRef.current.size === 0) {
      setDragging(false)
    } else if (pointersRef.current.size === 1) {
      const [id, pt] = pointersRef.current.entries().next().value!
      dragRef.current = { id, x: pt.x, y: pt.y }
      setDragging(true)
    }
  }

  const pin =
    view && nat
      ? pinScreenPosition(view, px, py, nat.w, nat.h)
      : null

  return (
    <div
      ref={viewportRef}
      className="location-map-viewport"
      aria-label={locale.location.mapViewportAria}
      style={{ cursor: dragging ? "grabbing" : "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
    >
      <div
        className="location-map-stage"
        style={{
          width: nat?.w ?? 1,
          height: nat?.h ?? 1,
          opacity: view && nat ? 1 : 0,
          transform: view
            ? `translate(${view.x}px, ${view.y}px) scale(${view.scale})`
            : "translate(0px, 0px) scale(1)",
        }}
      >
        <img
          ref={imgRef}
          src={mapUrl}
          alt=""
          className="location-map-img"
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          onLoad={(event) => applyNaturalSize(event.currentTarget)}
        />
      </div>
      {pin ? (
        <span
          className="location-detail-dot"
          style={{ left: pin.x, top: pin.y }}
        />
      ) : null}

      <style jsx>{`
        .location-map-viewport {
          position: absolute;
          inset: 0;
          overflow: hidden;
          touch-action: none;
          user-select: none;
          overscroll-behavior: contain;
        }

        .location-map-stage {
          position: absolute;
          left: 0;
          top: 0;
          transform-origin: 0 0;
          will-change: transform;
          pointer-events: none;
        }

        .location-map-img {
          display: block;
          width: 100%;
          height: 100%;
          max-width: none;
          pointer-events: none;
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
          z-index: 1;
        }
      `}</style>
    </div>
  )
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
  const [allowPinTransition, setAllowPinTransition] = useState(false)
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

  useEffect(() => {
    setAllowPinTransition(false)
    const id = requestAnimationFrame(() => setAllowPinTransition(true))
    return () => cancelAnimationFrame(id)
  }, [mapUrl])

  const pinTravel = allowPinTransition
    ? `${MAP_TRANSITION_MS}ms ${MAP_TRANSITION_EASING}`
    : "none"

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
              transition:
                pinTravel === "none" ? "none" : `object-position ${pinTravel}`,
            }}
            draggable={false}
          />
          <span
            className="mini-map-dot"
            style={{
              left: `${px * 100}%`,
              top: `${py * 100}%`,
              transition:
                pinTravel === "none" ? "none" : `left ${pinTravel}, top ${pinTravel}`,
            }}
          />
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
              {open ? <LocationMapViewport mapUrl={mapUrl} px={px} py={py} /> : null}
              <p className="location-detail-map-hint">{locale.location.mapPanZoomHint}</p>
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
          filter: brightness(1.1);
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

        .location-detail-map-hint {
          position: absolute;
          left: 8px;
          right: 8px;
          bottom: 8px;
          margin: 0;
          z-index: 2;
          pointer-events: none;
          text-align: center;
          font-size: 14px;
          letter-spacing: 0.08em;
          color: var(--rs-text-dim);
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.85);
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
