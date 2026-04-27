import type { Character, Location, Scene, StoryImage, Work } from "./types"
import { supabase } from "./supabase"

export const WESTEROS_MAP_URL = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto/v1/raree-show/maps/westeros`

// --- characters (Supabase) ---

type CharacterRow = {
  tsid: string
  name: string
  house: string | null
  description: string
  portrait_url: string | null
  work_id: string | null
}

function characterFromRow(row: CharacterRow): Character {
  return {
    id: row.tsid,
    name: row.name,
    aliases: [],
    house: row.house ?? "",
    titles: [],
    status: "unknown",
    origin: "",
    description: row.description,
    appeared_in: [],
    image_url: row.portrait_url ?? "",
  }
}

export async function getAllCharacters(): Promise<Character[]> {
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .order("name", { ascending: true })

  if (error) throw error

  return (data as CharacterRow[]).map(characterFromRow)
}

export async function getCharacterById(id: string): Promise<Character | undefined> {
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("tsid", id)
    .maybeSingle()

  if (error || !data) return undefined

  return characterFromRow(data as CharacterRow)
}

// --- locations (Supabase) ---

type LocationRow = {
  tsid: string
  name: string
  region: string | null
  description: string
  map_focus_x: number | null
  map_focus_y: number | null
  work_id: string | null
}

function locationFromRow(row: LocationRow): Location {
  return {
    id: row.tsid,
    name: row.name,
    type: "other",
    region: row.region ?? "",
    description: row.description,
    related_characters: [],
    scenes: [],
    map_focus_x: row.map_focus_x ?? null,
    map_focus_y: row.map_focus_y ?? null,
  }
}

export async function getAllLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .order("name", { ascending: true })

  if (error) throw error

  return (data as LocationRow[]).map(locationFromRow)
}

export async function getLocationById(id: string): Promise<Location | undefined> {
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("tsid", id)
    .maybeSingle()

  if (error || !data) return undefined

  return locationFromRow(data as LocationRow)
}

// --- scenes (Supabase) ---

type SceneRow = {
  tsid: string
  title: string
  scene_time?: string | null
  chapter_number: number
  chapter_title: string | null
  pov_character: string
  location_id: string | null
  character_ids: string[] | null
  summary: string
  tags: string[] | null
  order_index: number
  work_id: string | null
  timeline?: string | null
  map_focus_x: number | null
  map_focus_y: number | null
  story_images_v2?: unknown
}

function storyImagesV2FromRow(raw: unknown): StoryImage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: StoryImage[] = []
  for (const item of raw) {
    if (item !== null && typeof item === "object" && "url" in item) {
      const rec = item as { url: unknown; caption?: unknown }
      if (typeof rec.url === "string" && rec.url.trim()) {
        out.push({
          url: rec.url.trim(),
          caption: typeof rec.caption === "string" ? rec.caption : "",
        })
      }
    }
  }
  return out.length > 0 ? out : null
}

function sceneFromRow(row: SceneRow): Scene {
  return {
    id: row.tsid,
    tsid: row.tsid,
    title: row.title,
    scene_time: row.scene_time ?? null,
    chapter_number: row.chapter_number,
    chapter_title: row.chapter_title ?? null,
    pov_character: row.pov_character,
    location: row.location_id ?? "",
    characters_present: row.character_ids ?? [],
    summary: row.summary,
    tags: row.tags ?? [],
    order: row.order_index,
    order_index: row.order_index,
    orderIndex: row.order_index,
    timeline: row.timeline ?? undefined,
    map_focus:
      row.map_focus_x != null && row.map_focus_y != null
        ? { x: row.map_focus_x, y: row.map_focus_y }
        : undefined,
    work_id: row.work_id ?? undefined,
    story_images_v2: storyImagesV2FromRow(row.story_images_v2),
  }
}

export async function getAllScenes(): Promise<Scene[]> {
  const { data, error } = await supabase
    .from("scenes")
    .select("*")
    .order("order_index", { ascending: true })

  if (error) throw error

  return (data as SceneRow[]).map(sceneFromRow)
}

export async function getSceneById(id: string): Promise<Scene | undefined> {
  const { data, error } = await supabase
    .from("scenes")
    .select("*")
    .eq("tsid", id)
    .maybeSingle()

  if (error || !data) return undefined

  return sceneFromRow(data as SceneRow)
}

export async function getScenesByWork(workTsid: string): Promise<Scene[]> {
  const { data: work, error: workError } = await supabase
    .from("works")
    .select("id")
    .eq("tsid", workTsid)
    .maybeSingle()

  if (workError || !work) return []

  const { data, error } = await supabase
    .from("scenes")
    .select("*")
    .eq("work_id", work.id)
    .order("chapter_number", { ascending: true })
    .order("order_index", { ascending: true })

  if (error) return []
  return (data as SceneRow[]).map(sceneFromRow)
}

// --- works (Supabase) ---

type WorkRow = {
  id: string
  tsid: string
  title: string
  description: string
  cover_image?: string | null
  created_at?: string | null
}

function workFromRow(row: WorkRow): Work {
  return {
    id: row.tsid,
    tsid: row.tsid,
    title: row.title,
    description: row.description,
    cover_image: row.cover_image ?? undefined,
  }
}

export async function getAllWorks(): Promise<Work[]> {
  const { data, error } = await supabase
    .from("works")
    .select("*")
    .order("created_at", { ascending: true })

  if (error) throw error

  return (data as WorkRow[]).map(workFromRow)
}

export async function getWorkById(id: string): Promise<Work | undefined> {
  const { data, error } = await supabase
    .from("works")
    .select("*")
    .eq("tsid", id)
    .maybeSingle()

  if (error || !data) return undefined

  return workFromRow(data as WorkRow)
}
