import type { Character, Location, Scene, Work } from "./types"
import { supabase } from "./supabase"

import portraitUrls from "../../data/portrait-urls.json"
import charactersJson from "../../data/characters.json"
import locationsJson from "../../data/locations.json"

export const WESTEROS_MAP_URL = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto/v1/raree-show/maps/westeros`

// --- characters ---

export function getAllCharacters(): Character[] {
  const characters = charactersJson as Character[]
  return characters.map((char) => ({
    ...char,
    image_url:
      portraitUrls[char.id as keyof typeof portraitUrls] ?? "",
  }))
}

export function getCharacterById(id: string): Character | undefined {
  return getAllCharacters().find((c) => c.id === id)
}

// --- locations ---

export function getAllLocations(): Location[] {
  return locationsJson as Location[]
}

export function getLocationById(id: string): Location | undefined {
  return getAllLocations().find((l) => l.id === id)
}

// --- scenes (Supabase) ---

type SceneRow = {
  tsid: string
  title: string
  book: number
  chapter: number
  pov_character: string
  location_id: string | null
  character_ids: string[] | null
  summary: string
  tags: string[] | null
  order_index: number
  work_id: string | null
  timeline?: string | null
  map_focus?: Scene["map_focus"] | null
}

function sceneFromRow(row: SceneRow): Scene {
  return {
    id: row.tsid,
    tsid: row.tsid,
    title: row.title,
    book: row.book,
    chapter: row.chapter,
    pov_character: row.pov_character,
    location: row.location_id ?? "",
    characters_present: row.character_ids ?? [],
    summary: row.summary,
    tags: row.tags ?? [],
    order: row.order_index,
    timeline: row.timeline ?? undefined,
    map_focus: row.map_focus ?? undefined,
    work_id: row.work_id ?? undefined,
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
    books: [],
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
