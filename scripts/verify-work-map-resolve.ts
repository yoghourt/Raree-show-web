/**
 * IMPLEMENT-WMA-001 — pure resolve gates for Reader.
 * Run: npx tsx scripts/verify-work-map-resolve.ts
 */
import assert from "node:assert/strict"
import {
  isValidLocationPin,
  resolveWorkMap,
} from "../src/lib/work-maps/resolve"

assert.deepEqual(
  resolveWorkMap({
    map_capability: "off",
    work_map: null,
    published_asset_url: null,
  }),
  { status: "not_applicable" }
)

const missing = resolveWorkMap({
  map_capability: "required",
  work_map: null,
  published_asset_url: null,
})
assert.equal(missing.status, "not_map_ready")

const ready = resolveWorkMap({
  map_capability: "required",
  work_map: {
    geometry_id: "geom_a",
    geometry_accepted_at: "2026-09-08T00:00:00Z",
    published_asset_id: "asset_1",
    published_asset_accepted_at: "2026-09-08T00:01:00Z",
  },
  published_asset_url: "https://cdn.example/map.png",
})
assert.equal(ready.status, "ready")
if (ready.status === "ready") {
  assert.equal(ready.published_asset_id, "asset_1")
  assert.equal(ready.published_asset_url, "https://cdn.example/map.png")
}

assert.equal(
  isValidLocationPin(
    { map_focus_x: 0.4, map_focus_y: 0.2, map_focus_geometry_id: null },
    "geom_a"
  ),
  false,
  "Westeros-era pins without geometry_id are invalid"
)

assert.equal(
  isValidLocationPin(
    { map_focus_x: 0.4, map_focus_y: 0.2, map_focus_geometry_id: "geom_a" },
    "geom_a"
  ),
  true
)

console.log("[OK] verify-work-map-resolve (IMPLEMENT-WMA-001)")
