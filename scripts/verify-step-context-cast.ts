/**
 * IMPLEMENT-SCC-001-L4-B — Step → Scene Context cast/place gates.
 * Run: npx tsx scripts/verify-step-context-cast.ts
 */
import assert from "node:assert/strict"
import { parseSceneContextsV1 } from "../src/lib/scene-context/parse"
import {
  resolveContextForStep,
  resolveStepCast,
  resolveStepPlace,
} from "../src/lib/scene-context/resolve-step-context"
import type { Character, Location } from "../src/lib/types"

const characters: Character[] = [
  {
    id: "char_arya",
    name: "Arya Stark",
    aliases: [],
    house: "Stark",
    titles: [],
    status: "alive",
    origin: "",
    description: "Needle",
    appeared_in: [],
    image_url: "https://example.com/arya.jpg",
  },
  {
    id: "char_sansa",
    name: "Sansa Stark",
    aliases: [],
    house: "Stark",
    titles: [],
    status: "alive",
    origin: "",
    description: "Lady",
    appeared_in: [],
    image_url: "",
  },
]

const locations: Location[] = [
  {
    id: "loc_winterfell",
    name: "Winterfell",
    type: "castle",
    region: "North",
    description: "",
    related_characters: [],
    scenes: [],
    map_focus_x: 0.42,
    map_focus_y: 0.18,
  },
]

const rawContexts = [
  {
    contextId: "ctx_0",
    projectsToFrameIndex: 0,
    characterAppearanceContext: [
      { role: "protagonist", name: "Arya", archiveTsid: "char_arya" },
    ],
    locationContext: {
      environmentFromExpression: "snowy courtyard",
      archiveTsid: "loc_winterfell",
      archiveName: "Winterfell",
    },
  },
  {
    contextId: "ctx_1",
    projectsToFrameIndex: 1,
    characterAppearanceContext: [
      { role: "witness", name: "Sansa", archiveTsid: "char_sansa" },
    ],
    locationContext: {
      environmentFromExpression: "great hall",
      archiveName: "Great Hall",
    },
  },
]

const contexts = parseSceneContextsV1(rawContexts)
assert.equal(contexts.length, 2)

const step0 = resolveContextForStep(contexts, 0)
const step1 = resolveContextForStep(contexts, 1)
const missing = resolveContextForStep(contexts, 9)

assert.equal(step0?.contextId, "ctx_0")
assert.equal(step1?.contextId, "ctx_1")
assert.equal(missing, null, "RDX-RS-06 graceful absence")

const cast0 = resolveStepCast(step0, characters)
const cast1 = resolveStepCast(step1, characters)
assert.deepEqual(
  cast0.map((c) => c.id),
  ["char_arya"],
  "Step 0 cast ⊆ Context 0"
)
assert.deepEqual(
  cast1.map((c) => c.id),
  ["char_sansa"],
  "Step 1 cast ⊆ Context 1"
)
assert.ok(
  !cast0.some((c) => c.id === "char_sansa"),
  "Step 0 MUST NOT show Step 1-only cast"
)
assert.ok(
  !cast1.some((c) => c.id === "char_arya"),
  "Step 1 MUST NOT show Step 0-only cast"
)
assert.equal(cast0[0]?.image_url, "https://example.com/arya.jpg")
assert.deepEqual(resolveStepCast(null, characters), [], "no invented Work-wide cast")

const place0 = resolveStepPlace(step0, locations, "Unknown")
const place1 = resolveStepPlace(step1, locations, "Unknown")
const placeMissing = resolveStepPlace(null, locations, "Unknown")

assert.equal(place0.displayName, "Winterfell")
assert.equal(place0.mapX, 0.42)
assert.equal(place0.mapY, 0.18)
assert.equal(place1.displayName, "Great Hall", "expression/name cue without archive")
assert.equal(placeMissing.displayName, "Unknown")
assert.equal(placeMissing.mapX, 0.5)

// Assistant alignment: same names as rail
assert.deepEqual(
  cast0.map((c) => c.name),
  ["Arya Stark"]
)
assert.deepEqual(
  cast1.map((c) => c.name),
  ["Sansa Stark"]
)

// Membership fields must not be required by parse
assert.equal(parseSceneContextsV1(null).length, 0)
assert.equal(parseSceneContextsV1([{ projectsToFrameIndex: 0 }]).length, 0)

console.log("[OK] verify-step-context-cast (L4-B)")
