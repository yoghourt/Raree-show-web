import fs from "fs"
import path from "path"
import type { Character, Location, Scene, Work } from "./types"

const DATA_DIR = path.join(process.cwd(), "data")

function readJSON<T>(filename: string): T {
  const file = fs.readFileSync(path.join(DATA_DIR, filename), "utf-8")
  return JSON.parse(file) as T
}

// --- characters ---

export function getAllCharacters(): Character[] {
  return readJSON<Character[]>("characters.json")
}

export function getCharacterById(id: string): Character | undefined {
  return getAllCharacters().find((c) => c.id === id)
}

// --- locations ---

export function getAllLocations(): Location[] {
  return readJSON<Location[]>("locations.json")
}

export function getLocationById(id: string): Location | undefined {
  return getAllLocations().find((l) => l.id === id)
}

// --- scenes ---

export function getAllScenes(): Scene[] {
  return readJSON<Scene[]>("scenes.json")
}

export function getSceneById(id: string): Scene | undefined {
  return getAllScenes().find((s) => s.id === id)
}

export function getScenesByBook(book: number): Scene[] {
  return getAllScenes()
    .filter((s) => s.book === book)
    .sort((a, b) => a.order - b.order)
}

// --- works ---
// 暂时 hardcode，Phase 2 接 Supabase 后替换

export function getAllWorks(): Work[] {
  return [
    {
      id: "asoiaf",
      title: "A Song of Ice and Fire",
      description:
        "An epic fantasy series by George R. R. Martin, set in the fictional continents of Westeros and Essos.",
      books: [
        { id: 1, title: "A Game of Thrones", published: 1996, chapters: 73 },
        { id: 2, title: "A Clash of Kings", published: 1998, chapters: 70 },
        { id: 3, title: "A Storm of Swords", published: 2000, chapters: 82 },
        { id: 4, title: "A Feast for Crows", published: 2005, chapters: 46 },
        { id: 5, title: "A Dance with Dragons", published: 2011, chapters: 73 },
      ],
    },
  ]
}

export function getWorkById(id: string): Work | undefined {
  return getAllWorks().find((w) => w.id === id)
}