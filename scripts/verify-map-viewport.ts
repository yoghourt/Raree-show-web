/**
 * Location-detail map pan/zoom math.
 * Run: npx tsx scripts/verify-map-viewport.ts
 */
import assert from "node:assert/strict"
import {
  clampView,
  coverScale,
  fitScale,
  pinScreenPosition,
  scaleToFramePin,
  viewCenteredOnPin,
  zoomAt,
  backgroundMapView,
} from "../src/lib/map-viewport"

const iw = 2000
const ih = 1000
const vw = 512
const vh = 512
const minS = fitScale(iw, ih, vw, vh)
const cover = coverScale(iw, ih, vw, vh)

assert.equal(minS, 512 / 2000)
assert.equal(cover, 512 / 1000)

const fitted = clampView({ scale: minS, x: 0, y: 0 }, iw, ih, vw, vh)
assert.equal(fitted.x, 0)
assert.equal(fitted.y, (vh - ih * minS) / 2)

const oversized = clampView({ scale: cover, x: 50, y: -10 }, iw, ih, vw, vh)
assert.equal(oversized.x, 0, "cannot pan past left edge")
assert.equal(oversized.y, 0, "cover height fills viewport")

const frameScale = scaleToFramePin(0.25, 0.4, iw, ih, vw, vh)
assert.ok(frameScale > cover, "extra zoom so pin can sit at center")

const pin = viewCenteredOnPin(frameScale, 0.25, 0.4, iw, ih, vw, vh)
const screen = pinScreenPosition(pin, 0.25, 0.4, iw, ih)
assert.ok(Math.abs(screen.x - vw / 2) < 0.01, "pin centered on x")
assert.ok(Math.abs(screen.y - vh / 2) < 0.01, "pin centered on y")

const before = { scale: cover, x: -100, y: -80 }
const originX = 200
const originY = 180
const imgX = (originX - before.x) / before.scale
const imgY = (originY - before.y) / before.scale
const zoomed = zoomAt(before, cover * 2, originX, originY, iw, ih, vw, vh, minS, cover * 4)
const after = pinScreenPosition(
  { scale: zoomed.scale, x: zoomed.x, y: zoomed.y },
  imgX / iw,
  imgY / ih,
  iw,
  ih
)
assert.ok(Math.abs(after.x - originX) < 0.5, "zoom keeps cursor point")
assert.ok(Math.abs(after.y - originY) < 0.5, "zoom keeps cursor point")

const atMin = zoomAt(fitted, minS * 0.5, 256, 256, iw, ih, vw, vh, minS, cover * 4)
assert.equal(atMin.scale, minS, "cannot zoom out past whole-map fit")

const screenVw = 1440
const screenVh = 900
for (const [px, py] of [
  [0.5, 0.5],
  [0.18, 0.22],
  [0.82, 0.71],
] as const) {
  const camera = backgroundMapView(px, py, iw, ih, screenVw, screenVh)
  const focused = pinScreenPosition(camera, px, py, iw, ih)
  assert.ok(Math.abs(focused.x - screenVw / 2) < 0.5, `background pin x centered at (${px}, ${py})`)
  assert.ok(Math.abs(focused.y - screenVh / 2) < 0.5, `background pin y centered at (${px}, ${py})`)
}

console.log("verify-map-viewport: ok")
