/**
 * IMPLEMENT-WMA-001 — load Work Map Authority for a Work (by Reader-facing tsid).
 */

import { supabase } from "@/lib/supabase"
import {
  resolveWorkMap,
  type MapCapability,
  type WorkMapResolution,
} from "@/lib/work-maps/resolve"

type WorkCapRow = {
  id: string
  map_capability: string | null
}

type WorkMapRow = {
  geometry_id: string | null
  geometry_accepted_at: string | null
  published_asset_id: string | null
  published_asset_accepted_at: string | null
}

type MediaAssetRow = {
  url: string
}

export async function loadWorkMapResolutionByWorkTsid(
  workTsid: string
): Promise<WorkMapResolution> {
  const { data: work, error: workError } = await supabase
    .from("works")
    .select("id, map_capability")
    .eq("tsid", workTsid)
    .maybeSingle()

  if (workError || !work) {
    return { status: "not_applicable" }
  }

  const row = work as WorkCapRow
  const map_capability: MapCapability =
    row.map_capability === "required" ? "required" : "off"

  if (map_capability === "off") {
    return { status: "not_applicable" }
  }

  const { data: map, error: mapError } = await supabase
    .from("work_maps")
    .select(
      "geometry_id, geometry_accepted_at, published_asset_id, published_asset_accepted_at"
    )
    .eq("work_id", row.id)
    .maybeSingle()

  if (mapError) {
    return {
      status: "not_map_ready",
      reasons: ["missing_work_map_row"],
    }
  }

  const work_map = (map as WorkMapRow | null) ?? null
  let published_asset_url: string | null = null

  if (work_map?.published_asset_id) {
    const { data: asset } = await supabase
      .from("media_assets")
      .select("url")
      .eq("id", work_map.published_asset_id)
      .maybeSingle()
    published_asset_url = (asset as MediaAssetRow | null)?.url ?? null
  }

  return resolveWorkMap({
    map_capability,
    work_map,
    published_asset_url,
  })
}
