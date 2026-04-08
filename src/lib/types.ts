export interface Character {
  id: string
  name: string
  aliases: string[]
  house: string
  titles: string[]
  status: "alive" | "dead" | "unknown"
  origin: string
  description: string
  appeared_in: string[]
  image_url?: string
}

export interface Location {
  id: string
  name: string
  type: "castle" | "city" | "region" | "landmark" | "other"
  region: string
  description: string
  related_characters: string[]
  scenes: string[]
  image_url?: string
  map_focus_x?: number | null
  map_focus_y?: number | null
}

export interface Scene {
  id: string
  tsid: string
  title: string
  scene_time?: string | null
  chapter_number: number
  chapter_title: string | null
  pov_character: string
  location: string
  characters_present: string[]
  summary: string
  tags: string[]
  order: number
  order_index?: number
  orderIndex?: number
  timeline?: string
  map_focus?: {
    x: number
    y: number
  }
  work_id?: string
  story_images?: Array<{ url: string; caption: string }>
}

export interface Work {
  id: string
  tsid: string
  title: string
  description: string
  cover_image?: string
}
