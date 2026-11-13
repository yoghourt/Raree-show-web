export const READER_GUIDE_OBSTACLES = [
  ".caption-display-panel",
  ".rs-scene-right-rail-rack",
  ".scene-nav-buttons",
] as const

/** Cards and story copy only. The rail column is taller than the portraits and must not shrink the plaque. */
export const READER_GUIDE_TOOLTIP_OBSTACLES = [
  ".character-card",
  ".caption-display-text",
  ".caption-chapter-roman",
  ".caption-chapter-title",
  ".caption-scene-progress",
  ".mini-map-root",
  ".scene-nav-buttons",
] as const

const DESKTOP_TOOLTIP_WIDTH = 266
const TOOLTIP_CTA_OVERLAP = 32
const TOOLTIP_NUDGE_LIMIT = 96
const TOOLTIP_GAP = 12
const OBSTACLE_GAP = 6
const VIEWPORT_GAP = 8

export type GuideRect = {
  left: number
  top: number
  right: number
  bottom: number
}

export type ReaderGuideLayout = {
  anchorRight: number
  anchorBottom: number
  tooltipWidth: number
  tooltipRight: number
  tooltipLift: number
  tooltipPointerRight: number
  panelMaxHeight: number
}

function overlapArea(a: GuideRect, b: GuideRect): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  if (width <= 1 || height <= 1) return 0
  return width * height
}

function outsideArea(box: GuideRect, viewport: GuideRect): number {
  const insideWidth = Math.max(0, Math.min(box.right, viewport.right) - Math.max(box.left, viewport.left))
  const insideHeight = Math.max(0, Math.min(box.bottom, viewport.bottom) - Math.max(box.top, viewport.top))
  const area = Math.max(0, box.right - box.left) * Math.max(0, box.bottom - box.top)
  return Math.max(0, area - insideWidth * insideHeight)
}

function penalty(box: GuideRect, viewport: GuideRect, obstacles: GuideRect[]): number {
  const blocked = obstacles.reduce((sum, obstacle) => sum + overlapArea(box, obstacle), 0)
  return blocked + outsideArea(box, viewport)
}

function expand(rect: GuideRect, pad: number): GuideRect {
  return {
    left: rect.left - pad,
    top: rect.top - pad,
    right: rect.right + pad,
    bottom: rect.bottom + pad,
  }
}

function shrink(rect: GuideRect, pad: number): GuideRect {
  return {
    left: rect.left + pad,
    top: rect.top + pad,
    right: rect.right - pad,
    bottom: rect.bottom - pad,
  }
}

function toRect(rect: Pick<DOMRect, "left" | "top" | "right" | "bottom">): GuideRect {
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
}

function readSafeArea(side: "top" | "right" | "bottom" | "left"): number {
  const probe = document.createElement("div")
  try {
    probe.style.position = "absolute"
    probe.style.visibility = "hidden"
    probe.style.pointerEvents = "none"
    const property =
      side === "top"
        ? "paddingTop"
        : side === "right"
          ? "paddingRight"
          : side === "bottom"
            ? "paddingBottom"
            : "paddingLeft"
    probe.style[property] = `env(safe-area-inset-${side}, 0px)`
    document.body.appendChild(probe)
    const value = Number.parseFloat(getComputedStyle(probe)[property])
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  } finally {
    probe.remove()
  }
}

function readViewport(): GuideRect {
  const top = readSafeArea("top")
  const right = readSafeArea("right")
  const bottom = readSafeArea("bottom")
  const left = readSafeArea("left")
  return shrink(
    {
      left,
      top,
      right: window.innerWidth - right,
      bottom: window.innerHeight - bottom,
    },
    VIEWPORT_GAP,
  )
}

function readNodes(selectors: readonly string[]): GuideRect[] {
  const rects: GuideRect[] = []
  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((node) => {
      if (!(node instanceof HTMLElement)) return
      const rect = node.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      rects.push(expand(toRect(rect), OBSTACLE_GAP))
    })
  }
  return rects
}

function readObstacles(): GuideRect[] {
  return readNodes(READER_GUIDE_OBSTACLES)
}

function clamp(value: number, min: number, max: number): number | null {
  const next = Math.round(value)
  if (next < min || next > max) return null
  return next
}

function chooseAnchorOffset(args: {
  slot: GuideRect
  ctaWidth: number
  ctaHeight: number
  viewport: GuideRect
  obstacles: GuideRect[]
  preferredBottom: number
  minBottom: number
}): { right: number; bottom: number } {
  const maxBottom = Math.max(
    args.minBottom,
    Math.ceil(args.slot.bottom - args.viewport.top - args.ctaHeight),
  )
  const maxRight = Math.max(0, Math.ceil(args.slot.right - args.viewport.left - args.ctaWidth))
  const bottoms = new Set<number>([Math.round(args.preferredBottom), Math.round(args.minBottom)])
  const rights = new Set<number>([0])
  const addBottom = (value: number) => {
    const next = clamp(value, args.minBottom, maxBottom)
    if (next != null) bottoms.add(next)
  }
  const addRight = (value: number) => {
    const next = clamp(value, 0, maxRight)
    if (next != null) rights.add(next)
  }

  for (const obstacle of args.obstacles) {
    addBottom(args.slot.bottom - (obstacle.top - OBSTACLE_GAP))
    addBottom(args.slot.bottom - (obstacle.bottom + OBSTACLE_GAP + args.ctaHeight))
    addRight(args.slot.right - (obstacle.left - OBSTACLE_GAP))
    addRight(args.slot.right - (obstacle.right + OBSTACLE_GAP + args.ctaWidth))
  }
  for (let bottom = args.minBottom; bottom <= maxBottom; bottom += 24) addBottom(bottom)
  for (let right = 0; right <= maxRight; right += 24) addRight(right)

  let best: { right: number; bottom: number; cost: number; score: number } | null = null
  for (const bottom of bottoms) {
    for (const right of rights) {
      const box: GuideRect = {
        right: args.slot.right - right,
        left: args.slot.right - right - args.ctaWidth,
        bottom: args.slot.bottom - bottom,
        top: args.slot.bottom - bottom - args.ctaHeight,
      }
      const cost = penalty(box, args.viewport, args.obstacles)
      const score = Math.abs(bottom - args.preferredBottom) * 1000 + right
      if (
        !best ||
        cost < best.cost ||
        (cost === best.cost && score < best.score)
      ) {
        best = { right, bottom, cost, score }
      }
      if (cost === 0 && score === 0) return { right, bottom }
    }
  }

  return best ?? { right: 0, bottom: args.preferredBottom }
}

function tooltipBoxAt(cta: GuideRect, width: number, height: number, right: number, lift: number): GuideRect {
  const bottom = cta.top - TOOLTIP_GAP - lift
  return {
    right,
    left: right - width,
    bottom,
    top: bottom - height,
  }
}

function chooseTooltip(args: {
  cta: GuideRect
  viewport: GuideRect
  obstacles: GuideRect[]
  narrow: boolean
  measureHeight: (width: number) => number
}): { width: number; right: number; lift: number; pointerRight: number } {
  const room = Math.max(0, Math.floor(args.viewport.right - args.viewport.left))
  let width = Math.min(DESKTOP_TOOLTIP_WIDTH, room)
  if (args.narrow) {
    const cardLeft = args.obstacles
      .filter((obstacle) => obstacle.left > args.cta.left && obstacle.bottom > args.cta.top - 220)
      .reduce((left, obstacle) => Math.min(left, obstacle.left), args.viewport.right)
    const besideCards = Math.floor(cardLeft - 8 - args.viewport.left)
    if (besideCards >= 200) width = Math.min(width, besideCards)
  } else {
    width = Math.min(DESKTOP_TOOLTIP_WIDTH, Math.max(width, Math.min(260, room)))
  }
  const height = args.measureHeight(width)
  const preferred = args.cta.left + TOOLTIP_CTA_OVERLAP
  const minEdge = Math.max(args.viewport.left + width, args.cta.left - TOOLTIP_NUDGE_LIMIT)
  const maxEdge = Math.min(args.viewport.right, Math.max(minEdge, args.cta.left + 72))
  const edges: number[] = []
  for (let edge = Math.round(preferred); edge <= maxEdge; edge += 8) edges.push(edge)
  for (let edge = Math.round(preferred) - 8; edge >= minEdge; edge -= 8) edges.push(edge)

  let rightEdge = Math.max(minEdge, Math.min(maxEdge, preferred))
  let lift = 0
  let placed = false
  for (const nextLift of [0, 16, 32]) {
    for (const edge of edges) {
      const box = tooltipBoxAt(args.cta, width, height, edge, nextLift)
      if (penalty(box, args.viewport, args.obstacles) === 0) {
        rightEdge = edge
        lift = nextLift
        placed = true
        break
      }
    }
    if (placed) break
  }

  const ctaWidth = args.cta.right - args.cta.left
  const aim = Math.min(args.cta.right - 12, args.cta.left + Math.max(24, ctaWidth * 0.16))
  const pointerRight = Math.max(-8, Math.min(width - 28, Math.round(rightEdge - aim - 8)))
  const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)
  return {
    width: finite(width, DESKTOP_TOOLTIP_WIDTH),
    right: finite(Math.round(args.cta.right - rightEdge), Math.max(0, ctaWidth - TOOLTIP_CTA_OVERLAP)),
    lift,
    pointerRight: finite(pointerRight, 22),
  }
}

export function layoutReaderGuide(args: {
  slot: DOMRect
  cta: HTMLElement
  tooltip: HTMLElement | null
}): ReaderGuideLayout {
  const slot = toRect(args.slot)
  const ctaWidth = args.cta.offsetWidth
  const ctaHeight = args.cta.offsetHeight
  const viewport = readViewport()
  const obstacles = readObstacles()
  const safeBottom = readSafeArea("bottom")
  const narrow = window.innerWidth <= 640
  const preferredBottom = (narrow ? 56 : 0) + safeBottom
  const anchor = narrow
    ? { right: 0, bottom: preferredBottom }
    : chooseAnchorOffset({
        slot,
        ctaWidth,
        ctaHeight,
        viewport,
        obstacles,
        minBottom: safeBottom,
        preferredBottom,
      })
  const cta: GuideRect = {
    right: slot.right - anchor.right,
    left: slot.right - anchor.right - ctaWidth,
    bottom: slot.bottom - anchor.bottom,
    top: slot.bottom - anchor.bottom - ctaHeight,
  }
  const tooltip = args.tooltip
    ? chooseTooltip({
        cta,
        viewport,
        obstacles: [...readNodes(READER_GUIDE_TOOLTIP_OBSTACLES), expand(cta, OBSTACLE_GAP)],
        narrow,
        measureHeight: (width) => {
          const node = args.tooltip
          if (!node) return 0
          node.style.width = `${width}px`
          node.style.maxWidth = `${width}px`
          return node.offsetHeight
        },
      })
    : { width: DESKTOP_TOOLTIP_WIDTH, right: Math.max(0, ctaWidth - TOOLTIP_CTA_OVERLAP), lift: 0, pointerRight: 28 }
  if (args.tooltip) {
    args.tooltip.style.width = `${tooltip.width}px`
    args.tooltip.style.maxWidth = `${tooltip.width}px`
  }
  const availableAbove = cta.top - TOOLTIP_GAP - viewport.top
  return {
    anchorRight: anchor.right,
    anchorBottom: anchor.bottom,
    tooltipWidth: tooltip.width,
    tooltipRight: tooltip.right,
    tooltipLift: tooltip.lift,
    tooltipPointerRight: tooltip.pointerRight,
    panelMaxHeight: Math.max(160, Math.min(500, Math.floor(availableAbove))),
  }
}
