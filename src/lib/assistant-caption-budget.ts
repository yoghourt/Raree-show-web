export const ASSISTANT_CONTEXT_CHAR_BUDGET = 24_000

export type CaptionRoute = {
  tsid: string
  title: string
  chapter_number: number
  order_index: number
  captions: string[]
  summary: string
}

export type BudgetSelection = {
  routes: CaptionRoute[]
  summaries: { tsid: string; title: string; summary: string }[]
  omittedRouteCount: number
  currentSummary: string
  characterCardsIncluded: boolean
}

function captionLength(route: CaptionRoute): number {
  return route.captions.reduce((sum, caption) => sum + caption.length, 0)
}

function compareReadingOrder(a: CaptionRoute, b: CaptionRoute): number {
  if (a.chapter_number !== b.chapter_number) return a.chapter_number - b.chapter_number
  if (a.order_index !== b.order_index) return a.order_index - b.order_index
  if (a.tsid < b.tsid) return -1
  if (a.tsid > b.tsid) return 1
  return 0
}

function nearestFirst(routes: CaptionRoute[]): CaptionRoute[] {
  return [...routes].sort((a, b) => compareReadingOrder(b, a))
}

export function trimCurrentCaptions(captions: string[], budget: number): string[] {
  const kept: string[] = []
  let used = 0
  for (let index = captions.length - 1; index >= 0; index -= 1) {
    const caption = captions[index] ?? ""
    if (kept.length > 0 && used + caption.length > budget) break
    kept.push(caption)
    used += caption.length
    if (used > budget) break
  }
  return kept.reverse()
}

export function isStrictlyBeforeProgress(
  route: Pick<CaptionRoute, "chapter_number" | "order_index" | "tsid">,
  progress: { readUpToChapter: number; readUpToOrderIndex: number; sceneTsid: string }
): boolean {
  if (route.tsid === progress.sceneTsid) return false
  if (route.chapter_number < progress.readUpToChapter) return true
  return route.chapter_number === progress.readUpToChapter && route.order_index < progress.readUpToOrderIndex
}

export function applyFrameRules(
  routes: CaptionRoute[],
  progress: { readUpToChapter: number; readUpToOrderIndex: number; sceneTsid: string; readUpToStoryIndexLast: number },
  ceiling: "progress" | "work"
): CaptionRoute[] {
  if (ceiling === "work") {
    return routes.map((route) => ({ ...route, captions: [...route.captions] }))
  }
  return routes.flatMap((route) => {
    if (route.tsid === progress.sceneTsid) {
      const last = progress.readUpToStoryIndexLast
      const captions = last < 0 ? [] : route.captions.slice(0, last + 1)
      return [{ ...route, captions }]
    }
    if (!isStrictlyBeforeProgress(route, progress)) {
      return [{ ...route, captions: [] }]
    }
    return [{ ...route, captions: [...route.captions] }]
  })
}

export function budgetAuthorizedRoutes(args: {
  routes: CaptionRoute[]
  currentTsid: string
  rankedTsids: string[]
  ceiling: "progress" | "work"
  characterCardChars?: number
  budget?: number
}): BudgetSelection {
  const budget = args.budget ?? ASSISTANT_CONTEXT_CHAR_BUDGET
  const byTsid = new Map(args.routes.map((route) => [route.tsid, route]))
  const current = byTsid.get(args.currentTsid)
  const others = args.routes.filter((route) => route.tsid !== args.currentTsid && route.captions.length > 0)
  const ranked = args.rankedTsids
    .map((tsid) => byTsid.get(tsid))
    .filter((route): route is CaptionRoute => route != null && route.tsid !== args.currentTsid && route.captions.length > 0)
  const rankedIds = new Set(ranked.map((route) => route.tsid))
  const rest = nearestFirst(others.filter((route) => !rankedIds.has(route.tsid)))
  const orderedOthers = [...ranked, ...rest]

  let remaining = budget
  const included: CaptionRoute[] = []

  if (current) {
    const captions =
      captionLength(current) <= remaining ? current.captions : trimCurrentCaptions(current.captions, remaining)
    included.push({ ...current, captions })
    remaining -= captions.reduce((sum, caption) => sum + caption.length, 0)
  }

  const cardChars = args.ceiling === "work" ? Math.max(0, args.characterCardChars ?? 0) : 0
  const characterCardsIncluded = cardChars <= remaining
  if (characterCardsIncluded) remaining -= cardChars

  const captionRoutes: CaptionRoute[] = []
  for (const route of orderedOthers) {
    const size = captionLength(route)
    if (size > remaining) continue
    captionRoutes.push(route)
    remaining -= size
  }

  const chosen = [...included, ...captionRoutes].sort(compareReadingOrder)
  const chosenIds = new Set(chosen.map((route) => route.tsid))
  const omittedRouteCount = others.filter((route) => !chosenIds.has(route.tsid)).length

  const summaries: BudgetSelection["summaries"] = []
  let currentSummary = ""
  if (args.ceiling === "work") {
    for (const route of chosen) {
      const text = route.summary.trim()
      if (text === "" || text.length > remaining) continue
      remaining -= text.length
      if (current && route.tsid === current.tsid) {
        currentSummary = route.summary
        continue
      }
      summaries.push({ tsid: route.tsid, title: route.title, summary: route.summary })
    }
  }

  return {
    routes: chosen,
    summaries,
    omittedRouteCount,
    currentSummary,
    characterCardsIncluded,
  }
}
