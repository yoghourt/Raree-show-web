"use client"

/**
 * W-01 Browser Runtime — Visibility-Synchronized Navigation reducer.
 *
 * Authority chain (read-only):
 *   SPEC-RDX-001 → W-01 → runtime-architecture.md → this module
 *
 * Lifecycle mapping (comments only; no phase state machine):
 *   FULL_SYNC / route entry     → RDX-1 Reading Session Start
 *   STEP_NEXT / STEP_PREV       → RDX-3 Progress Update (intra-route)
 *   COMMIT_READING_ROUTE        → RDX-3 Progress Update (cross-route)
 *
 * `imageIndex` implements Reader Step index within effective Reading Frames
 * (SPEC-RDX-001). Field name preserved for Product Freeze — Sprint #1.
 *
 * Owner: W-01 (browser orchestration). Does not redefine Reader Step semantics.
 */

import { useEffect, useReducer } from "react"
import type { ReadingRoute } from "@/lib/types"

export type ReadingRouteState = {
  visualReadingRoute: ReadingRoute
  /** Implements Reader Step index within effective frames (SPEC-RDX-001). */
  imageIndex: number
}

export type ReadingRouteAction =
  | { type: "FULL_SYNC"; readingRoute: ReadingRoute; imageIndex: number }
  | { type: "SET_SLIDE"; imageIndex: number }
  | { type: "COMMIT_READING_ROUTE"; readingRoute: ReadingRoute; imageIndex: number }
  | { type: "STEP_NEXT" }
  | { type: "STEP_PREV" }

export function readingRouteReducer(
  state: ReadingRouteState,
  action: ReadingRouteAction
): ReadingRouteState {
  switch (action.type) {
    case "FULL_SYNC":
      return { visualReadingRoute: action.readingRoute, imageIndex: action.imageIndex }
    case "COMMIT_READING_ROUTE":
      return { visualReadingRoute: action.readingRoute, imageIndex: action.imageIndex }
    case "SET_SLIDE":
      if (action.imageIndex === state.imageIndex) return state
      return { ...state, imageIndex: action.imageIndex }
    case "STEP_NEXT":
      return { ...state, imageIndex: state.imageIndex + 1 }
    case "STEP_PREV":
      return { ...state, imageIndex: state.imageIndex - 1 }
    default:
      return state
  }
}

/**
 * Single source of truth for reading route + frame index so cross-route commits stay atomic
 * relative to Reading Route Assistant `userProgress`.
 */
export function useReadingRouteNavigation(currentReadingRoute: ReadingRoute) {
  const [state, dispatch] = useReducer(readingRouteReducer, {
    visualReadingRoute: currentReadingRoute,
    imageIndex: 0,
  })
  useEffect(() => {
    dispatch({ type: "FULL_SYNC", readingRoute: currentReadingRoute, imageIndex: 0 })
    // Only re-sync when the server route id changes; omit `currentReadingRoute` so RSC reference churn does not reset client-only navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [currentReadingRoute.id])

  return {
    visualReadingRoute: state.visualReadingRoute,
    imageIndex: state.imageIndex,
    dispatch,
  }
}
