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
}

export interface Scene {
  id: string
  tsid: string
  title: string
  book: number
  chapter: number
  pov_character: string
  location: string
  characters_present: string[]
  summary: string
  tags: string[]
  order: number
  timeline?: string
  map_focus?: {
    x: number
    y: number
  }
  work_id?: string
}

export interface Book {
  id: number
  title: string
  published: number
  chapters: number
}

export interface Work {
  id: string
  tsid: string
  title: string
  description: string
  cover_image?: string
  books: Book[]
}
