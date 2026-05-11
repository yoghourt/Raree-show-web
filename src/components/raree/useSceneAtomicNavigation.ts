"use client"

import { useEffect, useReducer } from "react"
import type { Scene } from "@/lib/types"

export type SceneReadingState = {
  visualScene: Scene
  imageIndex: number
}

export type SceneReadingAction =
  | { type: "FULL_SYNC"; scene: Scene; imageIndex: number }
  | { type: "SET_SLIDE"; imageIndex: number }
  | { type: "COMMIT_SCENE"; scene: Scene; imageIndex: number }
  | { type: "STEP_NEXT" }
  | { type: "STEP_PREV" }

export function sceneReadingReducer(state: SceneReadingState, action: SceneReadingAction): SceneReadingState {
  switch (action.type) {
    case "FULL_SYNC":
      return { visualScene: action.scene, imageIndex: action.imageIndex }
    case "COMMIT_SCENE":
      return { visualScene: action.scene, imageIndex: action.imageIndex }
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
 * Single source of truth for scene + story slide index so cross-scene commits stay atomic
 * relative to Scene Assistant `userProgress`.
 */
export function useSceneAtomicNavigation(currentScene: Scene) {
  const [state, dispatch] = useReducer(sceneReadingReducer, {
    visualScene: currentScene,
    imageIndex: 0,
  })
  useEffect(() => {
    dispatch({ type: "FULL_SYNC", scene: currentScene, imageIndex: 0 })
    // Only re-sync when the server route scene id changes; omit `currentScene` so RSC reference churn does not reset client-only navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [currentScene.id])

  return { visualScene: state.visualScene, imageIndex: state.imageIndex, dispatch }
}
