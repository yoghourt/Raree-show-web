/** Pure pan/zoom math for the location-detail map viewport. Map coords are 0–1. */

export type MapView = { scale: number; x: number; y: number }

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function fitScale(iw: number, ih: number, vw: number, vh: number): number {
  if (iw <= 0 || ih <= 0 || vw <= 0 || vh <= 0) return 1
  return Math.min(vw / iw, vh / ih)
}

export function coverScale(iw: number, ih: number, vw: number, vh: number): number {
  if (iw <= 0 || ih <= 0 || vw <= 0 || vh <= 0) return 1
  return Math.max(vw / iw, vh / ih)
}

export function maxScale(iw: number, ih: number, vw: number, vh: number): number {
  return Math.max(coverScale(iw, ih, vw, vh) * 4, fitScale(iw, ih, vw, vh) * 8, 2)
}

/** Zoom enough that the pin can sit at the viewport center (at least cover). */
export function scaleToFramePin(
  pinX: number,
  pinY: number,
  iw: number,
  ih: number,
  vw: number,
  vh: number
): number {
  const candidates = [coverScale(iw, ih, vw, vh)]
  if (pinX > 0) candidates.push(vw / 2 / (pinX * iw))
  if (pinX < 1) candidates.push(vw / 2 / ((1 - pinX) * iw))
  if (pinY > 0) candidates.push(vh / 2 / (pinY * ih))
  if (pinY < 1) candidates.push(vh / 2 / ((1 - pinY) * ih))
  return Math.min(Math.max(...candidates), maxScale(iw, ih, vw, vh))
}

export function clampView(
  view: MapView,
  iw: number,
  ih: number,
  vw: number,
  vh: number
): MapView {
  const mappedW = iw * view.scale
  const mappedH = ih * view.scale
  let x: number
  let y: number
  if (mappedW <= vw) {
    x = (vw - mappedW) / 2
  } else {
    x = clamp(view.x, vw - mappedW, 0)
  }
  if (mappedH <= vh) {
    y = (vh - mappedH) / 2
  } else {
    y = clamp(view.y, vh - mappedH, 0)
  }
  return { scale: view.scale, x, y }
}

export function viewCenteredOnPin(
  scale: number,
  pinX: number,
  pinY: number,
  iw: number,
  ih: number,
  vw: number,
  vh: number
): MapView {
  return clampView(
    {
      scale,
      x: vw / 2 - pinX * iw * scale,
      y: vh / 2 - pinY * ih * scale,
    },
    iw,
    ih,
    vw,
    vh
  )
}

export function zoomAt(
  view: MapView,
  nextScale: number,
  originX: number,
  originY: number,
  iw: number,
  ih: number,
  vw: number,
  vh: number,
  minS: number,
  maxS: number
): MapView {
  const scale = clamp(nextScale, minS, maxS)
  if (view.scale === 0) {
    return clampView({ scale, x: view.x, y: view.y }, iw, ih, vw, vh)
  }
  const imgX = (originX - view.x) / view.scale
  const imgY = (originY - view.y) / view.scale
  return clampView(
    { scale, x: originX - imgX * scale, y: originY - imgY * scale },
    iw,
    ih,
    vw,
    vh
  )
}

export function pinScreenPosition(
  view: MapView,
  pinX: number,
  pinY: number,
  iw: number,
  ih: number
): { x: number; y: number } {
  return {
    x: view.x + pinX * iw * view.scale,
    y: view.y + pinY * ih * view.scale,
  }
}

/** Close-up multiplier vs cover; keeps the background map zoomed in like the old 220–280% crop. */
export const BACKGROUND_MAP_COVER_MULTIPLIER = 2.2

/** Camera that places the 0–1 pin at the viewport center without letterboxing. */
export function backgroundMapView(
  pinX: number,
  pinY: number,
  iw: number,
  ih: number,
  vw: number,
  vh: number
): MapView {
  const framed = scaleToFramePin(pinX, pinY, iw, ih, vw, vh)
  const cinematic = coverScale(iw, ih, vw, vh) * BACKGROUND_MAP_COVER_MULTIPLIER
  const scale = Math.min(Math.max(framed, cinematic), maxScale(iw, ih, vw, vh))
  return viewCenteredOnPin(scale, pinX, pinY, iw, ih, vw, vh)
}
