/**
 * RAG retrieval smoke test — does not modify src/services/retrieval.ts.
 * Run from repo root: npx tsx scripts/smoke-test-retrieval.ts
 *
 * Env: .env.local — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
 * Optional: SMOKE_TEST_WORK_TSID (works.tsid); if unset, uses the first row in works.
 */

// Verifying ADR-002 Serial Pipeline: Metadata Pre-filtering -> Candidate Set -> Vector Rerank

import path from "path"
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import type { ProgressConfig } from "../src/services/retrieval"
import { retrieveScenes } from "../src/services/retrieval"

config({ path: path.resolve(process.cwd(), ".env.local") })

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`\n[FAIL] ${msg}`)
    process.exit(1)
  }
}

function progressAllowsScene(
  chapter: number,
  order: number,
  p: ProgressConfig
): boolean {
  return (
    chapter < p.readUpToChapter ||
    (chapter === p.readUpToChapter && order <= p.readUpToOrderIndex)
  )
}

async function resolveWorkTsid(): Promise<string> {
  const fromEnv = process.env.SMOKE_TEST_WORK_TSID?.trim()
  if (fromEnv) return fromEnv

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  assert(url && key, "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await supabase
    .from("works")
    .select("tsid")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  assert(!error, error?.message ?? "works query error")
  assert(data?.tsid, "No works row found; set SMOKE_TEST_WORK_TSID in .env.local")
  return data.tsid
}

async function countCandidatesInDb(
  workId: string,
  p: ProgressConfig
): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const ch = p.readUpToChapter
  const ord = p.readUpToOrderIndex
  const orFilter = `chapter_number.lt.${ch},and(chapter_number.eq.${ch},order_index.lte.${ord})`

  const { count, error } = await supabase
    .from("scenes")
    .select("*", { count: "exact", head: true })
    .eq("work_id", workId)
    .or(orFilter)

  assert(!error, error?.message ?? "candidate count query error")
  return count ?? 0
}

async function resolveWorkId(workTsid: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await supabase
    .from("works")
    .select("id")
    .eq("tsid", workTsid)
    .maybeSingle()
  assert(!error, error?.message ?? "work lookup error")
  assert(data?.id, `Unknown workTsid: ${workTsid}`)
  return data.id
}

async function main() {
  assert(
    process.env.GEMINI_API_KEY,
    "Missing GEMINI_API_KEY (check .env.local)"
  )

  const workTsid = await resolveWorkTsid()
  const workId = await resolveWorkId(workTsid)

  const userProgress: ProgressConfig = {
    workTsid,
    readUpToChapter: 1,
    readUpToOrderIndex: 5,
  }

  const expectedCandidates = await countCandidatesInDb(workId, userProgress)

  console.log("workTsid:", workTsid)
  console.log("userProgress:", userProgress)
  console.log("expected candidate count (DB):", expectedCandidates)

  const out = await retrieveScenes("测试查询词", userProgress)

  console.log("\n--- observability ---")
  console.log(JSON.stringify(out.observability, null, 2))

  console.log("\n--- results (tsid, title) ---")
  for (const r of out.results) {
    console.log(r.tsid, r.title ?? "")
  }

  assert(
    out.observability.candidateSetSize === expectedCandidates,
    `candidateSetSize mismatch: got ${out.observability.candidateSetSize}, expected ${expectedCandidates} (metadataPreFiltering vs DB count)`
  )

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const tsids = out.results.map((r) => r.tsid)
  if (tsids.length > 0) {
    const { data: rows, error } = await supabase
      .from("scenes")
      .select("tsid, chapter_number, order_index")
      .in("tsid", tsids)

    assert(!error, error?.message ?? "scenes meta fetch error")
    const byTsid = new Map(
      (rows ?? []).map((row) => [
        row.tsid as string,
        {
          chapter_number: row.chapter_number as number,
          order_index: row.order_index as number,
        },
      ])
    )

    for (const r of out.results) {
      const meta = byTsid.get(r.tsid)
      assert(meta, `Missing DB row for result tsid ${r.tsid}`)
      assert(
        progressAllowsScene(
          meta.chapter_number,
          meta.order_index,
          userProgress
        ),
        `Safety gate violation: tsid ${r.tsid} is chapter ${meta.chapter_number} order ${meta.order_index}, progress allows up to ch ${userProgress.readUpToChapter} order ${userProgress.readUpToOrderIndex}`
      )
    }
  }

  assert(
    out.observability.rerankScores.length === out.results.length,
    `rerankScores length ${out.observability.rerankScores.length} !== results length ${out.results.length}`
  )

  if (out.results.length > 0) {
    assert(
      out.observability.rerankScores.length > 0,
      "rerankScores must be non-empty when results are non-empty"
    )
    for (let i = 0; i < out.observability.rerankScores.length; i++) {
      const s = out.observability.rerankScores[i]
      assert(
        typeof s === "number" && Number.isFinite(s),
        `Invalid rerankScores[${i}]: ${String(s)}`
      )
    }
  }

  console.log("\n[OK] ADR-002 smoke test passed.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
