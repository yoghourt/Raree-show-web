/**
 * One-time migration: JSON → Supabase (characters, locations).
 *
 * Run from repo root:
 *   npx ts-node scripts/import-data.ts
 *   (or: npm run import-data)
 *
 * Requires `.env.local`: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from "fs"
import path from "path"
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { TSID } from "tsid-ts"

config({ path: path.resolve(__dirname, "../.env.local") })

const WORK_ID = "bf3ff2a6-4337-4b91-8d61-a4dc809898e5"
const BATCH_SIZE = 50

const ROOT = path.resolve(__dirname, "..")

type JsonCharacter = {
  id: string
  name: string
  house: string
  description: string
}

type JsonLocation = {
  id: string
  name: string
  region: string
  description: string
}

function newCharTsid(): string {
  return `char_${TSID.create().toStringWithFormat("s")}`
}

function newLocTsid(): string {
  return `loc_${TSID.create().toStringWithFormat("s")}`
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    )
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { count: charCount, error: charCountErr } = await supabase
    .from("characters")
    .select("*", { count: "exact", head: true })
    .eq("work_id", WORK_ID)

  if (charCountErr) throw charCountErr

  const { count: locCount, error: locCountErr } = await supabase
    .from("locations")
    .select("*", { count: "exact", head: true })
    .eq("work_id", WORK_ID)

  if (locCountErr) throw locCountErr

  if ((charCount ?? 0) > 0 || (locCount ?? 0) > 0) {
    console.log(
      `Skip: characters or locations already have rows for work_id=${WORK_ID} (characters: ${charCount ?? 0}, locations: ${locCount ?? 0}).`
    )
    process.exit(0)
  }

  const charactersJson = JSON.parse(
    readFileSync(path.join(ROOT, "data/characters.json"), "utf-8")
  ) as JsonCharacter[]

  const locationsJson = JSON.parse(
    readFileSync(path.join(ROOT, "data/locations.json"), "utf-8")
  ) as JsonLocation[]

  const portraitUrls = JSON.parse(
    readFileSync(path.join(ROOT, "data/portrait-urls.json"), "utf-8")
  ) as Record<string, string>

  const charTotal = charactersJson.length
  for (let i = 0; i < charTotal; i += BATCH_SIZE) {
    const slice = charactersJson.slice(i, i + BATCH_SIZE)
    const rows = slice.map((c) => ({
      tsid: newCharTsid(),
      name: c.name,
      house: c.house ?? "",
      description: c.description,
      portrait_url: portraitUrls[c.id] ?? null,
      work_id: WORK_ID,
    }))
    const { error } = await supabase.from("characters").insert(rows)
    if (error) throw error
    const done = Math.min(i + BATCH_SIZE, charTotal)
    console.log(`Importing characters... ${done}/${charTotal}`)
  }

  const locTotal = locationsJson.length
  for (let i = 0; i < locTotal; i += BATCH_SIZE) {
    const slice = locationsJson.slice(i, i + BATCH_SIZE)
    const rows = slice.map((loc) => ({
      tsid: newLocTsid(),
      name: loc.name,
      region: loc.region ?? "",
      description: loc.description,
      map_focus_x: null,
      map_focus_y: null,
      work_id: WORK_ID,
    }))
    const { error } = await supabase.from("locations").insert(rows)
    if (error) throw error
    const done = Math.min(i + BATCH_SIZE, locTotal)
    console.log(`Importing locations... ${done}/${locTotal}`)
  }

  console.log(
    `Done. Imported ${charTotal} characters and ${locTotal} locations for work_id=${WORK_ID}.`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
