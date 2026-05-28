/**
 * RAGAS v2: v1 XML story-index diagnostic is obsoleted by hash-authoritative oracle.
 * Captions in v2 are raw strings with no XML structure to parse.
 * Oracle correctness is enforced exclusively by sha256(Buffer.concat(captions)).
 */
import type { IndexDiagnostics, RareeSingleTurnSample } from "../types"

export function runIndexDiagnostic(_sample: RareeSingleTurnSample): IndexDiagnostics {
  return { storyIndexWarnings: [] }
}
