/**
 * Fetches character portrait images from awoiaf.westeros.org
 * Saves images to public/characters/{character-id}.jpg
 * Reads character list from data/characters.json
 */

import fs from "fs"
import path from "path"

const BASE_URL = "https://awoiaf.westeros.org/api.php"
const OUT_DIR = "./public/characters"
const CHARACTERS_FILE = "./data/characters.json"
const USER_AGENT =
  "RareeShowScraper/1.0 (https://github.com/yoghourt/raree-show-web)"
const MIN_IMAGE_BYTES = 10_000

async function fetchJSON(params) {
  const url = new URL(BASE_URL)
  const defaults = { format: "json", action: "query" }
  Object.entries({ ...defaults, ...params }).forEach(([k, v]) =>
    url.searchParams.set(k, v)
  )
  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "RareeShowScraper/1.0 (https://github.com/yoghourt/raree-show-web; personal portfolio project)",
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function getPortraitUrl(characterName) {
  // Get images listed on the character's page
  const data = await fetchJSON({
    prop: "images",
    titles: characterName,
  })
  const pages = Object.values(data?.query?.pages ?? {})
  if (!pages.length) return null
  
  const images = pages[0]?.images ?? []
  
  // Find the first image that looks like a portrait
  // (exclude icons, maps, logos — look for jpg/png with the character name)
  const portrait = images.find(img => {
    const name = img.title.toLowerCase()
    return (
      (name.endsWith(".jpg") || name.endsWith(".png")) &&
      !name.includes("icon") &&
      !name.includes("map") &&
      !name.includes("logo") &&
      !name.includes("sigil") &&
      !name.includes("banner") &&
      !name.includes("shield")
    )
  })
  
  if (!portrait) return null

  // Get the actual URL of this image file
  const imgData = await fetchJSON({
    prop: "imageinfo",
    iiprop: "url",
    titles: portrait.title,
  })
  const imgPages = Object.values(imgData?.query?.pages ?? {})
  if (!imgPages.length) return null
  return imgPages[0]?.imageinfo?.[0]?.url ?? null
}

async function fetchWithRedirect(url, redirectCount = 0) {
  if (redirectCount > 10) {
    throw new Error(`Too many redirects: ${url}`)
  }

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "manual",
  })

  // Handle redirects recursively and preserve headers.
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location")
    if (!location) throw new Error(`Redirect without location: ${res.status}`)
    const nextUrl = new URL(location, url).toString()
    return fetchWithRedirect(nextUrl, redirectCount + 1)
  }

  return res
}

async function downloadImage(url, destPath) {
  const res = await fetchWithRedirect(url)
  const contentType = res.headers.get("content-type") ?? ""

  if (!contentType.startsWith("image/")) {
    throw new Error(`Not an image: ${contentType}`)
  }

  const buffer = await res.arrayBuffer()
  fs.writeFileSync(destPath, Buffer.from(buffer))

  const stats = fs.statSync(destPath)
  if (stats.size < MIN_IMAGE_BYTES) {
    fs.unlinkSync(destPath)
    throw new Error(`File too small: ${stats.size} bytes`)
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  // Delete any existing portrait files that are likely to be HTML/error pages.
  const files = fs.readdirSync(OUT_DIR)
  for (const file of files) {
    const fullPath = path.join(OUT_DIR, file)
    const stat = fs.statSync(fullPath)
    if (!stat.isFile()) continue
    if (stat.size < MIN_IMAGE_BYTES) {
      fs.unlinkSync(fullPath)
    }
  }

  const characters = JSON.parse(fs.readFileSync(CHARACTERS_FILE, "utf-8"))
  console.log(`Processing ${characters.length} characters...`)

  let found = 0
  let missing = 0

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i]
    const destPath = path.join(OUT_DIR, `${char.id}.jpg`)

    // Skip if already downloaded
    if (fs.existsSync(destPath)) {
      console.log(`  [${i+1}/${characters.length}] Skip (exists): ${char.name}`)
      continue
    }

    try {
      const imageUrl = await getPortraitUrl(char.name)
      if (!imageUrl) {
        console.log(`  [${i+1}/${characters.length}] No image: ${char.name}`)
        missing++
        await sleep(150)
        continue
      }

      await downloadImage(imageUrl, destPath)
      console.log(`  [${i+1}/${characters.length}] Downloaded: ${char.name}`)
      found++
      await sleep(200)
    } catch (err) {
      console.warn(`  [${i+1}/${characters.length}] Error (${char.name}): ${err.message}`)
      missing++
      await sleep(150)
    }
  }

  console.log(`\nDone. Found: ${found}, Missing: ${missing}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})