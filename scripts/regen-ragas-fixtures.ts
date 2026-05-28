/**
 * Deterministic RAGAS v2 fixture regeneration.
 *
 * Reads seed-v2.json, recomputes expected_context_hash / expected_context_size
 * from each sample's reference_captions using production-authoritative raw-byte
 * semantics, and rewrites the file if any value has drifted.
 *
 * Governance model: assistive / human-reviewed.
 * This script MUST NOT auto-commit or silently authorize fixture changes.
 * Run: npm run regen:ragas-fixtures
 * Then: git diff eval/ragas/dataset/seed-v2.json
 */

import fs from "node:fs"
import path from "node:path"
import { hashRawCaptions } from "../src/lib/production-story-oracle"

const FIXTURE_PATH = path.resolve(__dirname, "../eval/ragas/dataset/seed-v2.json")

type Sample = {
  id: string
  reference_captions: string[]
  expected_context_hash: string
  expected_context_size: number
  [key: string]: unknown
}

function main(): void {
  const raw = fs.readFileSync(FIXTURE_PATH, "utf8")
  const samples = JSON.parse(raw) as Sample[]

  let driftCount = 0

  const updated = samples.map((sample) => {
    const { sha256, byteSize } = hashRawCaptions(sample.reference_captions)

    const hashDrifted = sha256 !== sample.expected_context_hash
    const sizeDrifted = byteSize !== sample.expected_context_size

    if (hashDrifted || sizeDrifted) {
      driftCount++
      console.log(`[DRIFT] ${sample.id}`)
      if (hashDrifted) {
        console.log(`  hash: stored=${sample.expected_context_hash}`)
        console.log(`         regen=${sha256}`)
      }
      if (sizeDrifted) {
        console.log(`  size: stored=${sample.expected_context_size}  regen=${byteSize}`)
      }
      return { ...sample, expected_context_hash: sha256, expected_context_size: byteSize }
    }

    return sample
  })

  if (driftCount === 0) {
    console.log(`OK — all ${samples.length} samples match production oracle semantics.`)
    return
  }

  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(updated, null, 2) + "\n")
  console.log(`\nRewritten: ${FIXTURE_PATH}`)
  console.log(`${driftCount} sample(s) updated. Review with: git diff eval/ragas/dataset/seed-v2.json`)
  console.log("Commit only after manual review.")
}

main()
