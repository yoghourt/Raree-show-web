const STORAGE_KEY = "rs-reader-guide-onboarding-v1"

/**
 * Origin-wide dismissal for the reading-guide cue.
 * The same key covers every work, scene, and locale in this browser.
 * A read failure is reported as dismissed so the cue stays hidden.
 */
export function readReaderGuideDismissed(): boolean {
  try {
    if (typeof window === "undefined") return true
    return window.localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return true
  }
}

const listeners = new Set<() => void>()
let cachedDismissed: boolean | null = null

function rememberDismissed(dismissed: boolean) {
  cachedDismissed = dismissed
  listeners.forEach((listener) => listener())
}

export function subscribeReaderGuide(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Client snapshot. `true` means the cue should be visible. Failures stay hidden. */
export function getReaderGuideCueVisible(): boolean {
  try {
    if (cachedDismissed === null) cachedDismissed = readReaderGuideDismissed()
    return !cachedDismissed
  } catch {
    return false
  }
}

/** Server and hydration snapshot: the cue stays hidden until the client store is read. */
export function getServerReaderGuideCueVisible(): boolean {
  return false
}

/** Persist dismissal. Storage failures are ignored; the in-memory cue still closes. */
export function writeReaderGuideDismissed(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1")
  } catch {
    // Private mode, disabled storage, or a full quota must not break the reader.
  }
  rememberDismissed(true)
}
