/**
 * RAG Phase 2 — serial retrieval runtime (ADR-002).
 *
 * Topology (mandatory, no routing / no fallback):
 *   metadataPreFiltering (SQL) → candidateSet → match_scenes RPC (vector rerank).
 *
 * Supabase `match_scenes` (contract — see `supabase/migrations/*match_scenes*.sql`):
 *   Params: query_embedding, work_id_filter (works.id UUID), candidate_tsids (text[]), match_count
 *   Returns: tsid, title, similarity = 1 - (rag_embedding <=> query_embedding)
 *   WHERE includes: scenes.tsid = ANY(candidate_tsids) so the vector sort runs only on the SQL gate output.
 *
 * confirm-db-contract — progress fields match [src/lib/data.ts](src/lib/data.ts) `SceneRow`:
 *   chapter_number + order_index (Day 24-25 PR #27); there is no chapter_id in the app schema.
 */

import { randomUUID } from "node:crypto"
import { cache } from "react"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import nodeFetch, { type RequestInit as NodeFetchRequestInit } from "node-fetch"
import { HttpsProxyAgent } from "https-proxy-agent"
import {
  buildChapterScenesXml,
  buildCurrentSceneRevealedXml,
} from "@/lib/scene-assistant-context"
import {
  buildStableRequestFingerprint,
  collectAuthorizedSemanticBytes,
  InvariantViolationError,
  normalizeQueryForFingerprint,
  verifyProductionStoryOracle,
} from "@/lib/production-story-oracle"
import {
  effectiveStorySlidesFromV2,
  sliceRevealedStorySlides,
} from "@/lib/story-images-v2"
import { assertReadUpToStoryIndexLast } from "@/lib/visibility-invariant"

/** Gemini embedding dimension locked with pgvector / backfill (ADR-001). */
const RAG_EMBEDDING_DIM = 768

const DEFAULT_MATCH_COUNT = 10

const MATCH_SCENES_RPC = "match_scenes" as const

let retrievalSupabase: SupabaseClient | null = null

function getRetrievalSupabase(): SupabaseClient {
  if (retrievalSupabase) return retrievalSupabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "retrieveScenes requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-only)."
    )
  }
  retrievalSupabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return retrievalSupabase
}

/**
 * Reading progress for spoiler-safe metadataPreFiltering + story-level prompt truncation.
 * `chapter_number` / `order_index` map to SceneRow; `sceneTsid` / `readUpToStoryIndexLast` refine current-scene captions.
 */
export type ProgressConfig = {
  workTsid: string
  readUpToChapter: number
  readUpToOrderIndex: number
  /** Current scene business id (`scenes.tsid`). */
  sceneTsid: string
  /**
   * 0-based index into the effective story list (non-empty `url` slides, same order as client ImageReel).
   * Inclusive: visible slide counts as revealed. Use `-1` when there are no slides.
   */
  readUpToStoryIndexLast: number
}

export type RetrievedScene = {
  tsid: string
} & Record<string, unknown>

export type RetrieveScenesResult = {
  results: RetrievedScene[]
  observability: {
    candidateSetSize: number
    retrievalLatency: number
    rerankScores: number[]
  }
}

/** LLM ingress bundle — semantic oracle verified in retrieval.ts before export. */
export type VerifiedAssistantContext = {
  requestId: string
  stableFingerprint: string
  /** Vector rerank rows (summaries non-authoritative for story oracle). */
  results: RetrievedScene[]
  /** Sole authoritative source for production story authorization bytes. */
  chapterScenes: ChapterSceneSnippet[]
  storyOracle: { byteSize: number; sha256: string }
  currentSceneRevealedXml: string
  chapterScenesXml: string
  observability: RetrieveScenesResult["observability"]
}

type RetrieveScenesUncachedResult = RetrieveScenesResult & {
  candidateTsids: string[]
}

type MatchScenesRpcRow = Record<string, unknown>

/** RPC args — aligned with Postgres `match_scenes` (single batch call; no per-id loops). */
type MatchScenesRpcArgs = {
  query_embedding: number[]
  work_id_filter: string
  candidate_tsids: string[]
  match_count: number
}

function extractRerankScore(row: MatchScenesRpcRow): number {
  const similarity = row.similarity
  const score = row.score
  const distance = row.distance
  if (typeof similarity === "number" && !Number.isNaN(similarity)) return similarity
  if (typeof score === "number" && !Number.isNaN(score)) return score
  if (typeof distance === "number" && !Number.isNaN(distance)) return distance
  return Number.NaN
}

function rowToRetrievedScene(row: MatchScenesRpcRow): RetrievedScene {
  const tsid = row.tsid
  if (typeof tsid !== "string" || !tsid) {
    throw new Error("match_scenes row missing string tsid")
  }
  return { ...row, tsid }
}

/** RPC may omit narrative fields; hydrate from `scenes` so the assistant prompt has summaries. */
async function mergeScenesTableSummaries(
  supabase: SupabaseClient,
  results: RetrievedScene[]
): Promise<RetrievedScene[]> {
  if (results.length === 0) return results
  const tsids = [...new Set(results.map((r) => r.tsid))]
  const { data, error } = await supabase
    .from("scenes")
    .select("tsid, title, summary")
    .in("tsid", tsids)

  if (error) throw error

  const byTsid = new Map<string, { title?: string; summary?: string }>()
  for (const row of data ?? []) {
    if (row && typeof row.tsid === "string") {
      byTsid.set(row.tsid, {
        title: typeof row.title === "string" ? row.title : undefined,
        summary: typeof row.summary === "string" ? row.summary : undefined,
      })
    }
  }

  return results.map((r) => {
    const extra = byTsid.get(r.tsid)
    if (!extra) return r
    const titleFromRow = extra.title?.trim() !== "" ? extra.title : undefined
    const summaryFromRow = extra.summary?.trim() !== "" ? extra.summary : undefined
    const hasTitle = typeof r.title === "string" && r.title.trim() !== ""
    const hasSummary = typeof r.summary === "string" && r.summary.trim() !== ""
    if (hasTitle && hasSummary) return r
    return {
      ...r,
      ...(!hasTitle && titleFromRow ? { title: titleFromRow } : {}),
      ...(!hasSummary && summaryFromRow ? { summary: summaryFromRow } : {}),
    }
  })
}

/**
 * Same-chapter revealed-scene context: physically truncated `story_images_v2` captions only (ADR-002 doc).
 */
export type ChapterSceneSnippet = {
  tsid: string
  title: string
  order_index: number
  revealedStorySlides: { caption: string }[]
}

export async function fetchChapterScenesWithinProgress(
  userProgress: ProgressConfig,
  chapterNumber: number
): Promise<ChapterSceneSnippet[]> {
  assertReadUpToStoryIndexLast(userProgress.readUpToStoryIndexLast)

  if (chapterNumber !== userProgress.readUpToChapter) {
    return []
  }

  const supabase = getRetrievalSupabase()
  const workId = await resolveWorkId(supabase, userProgress.workTsid)
  if (!workId) {
    throw new Error(`fetchChapterScenesWithinProgress: unknown workTsid ${userProgress.workTsid}`)
  }

  const { data, error } = await supabase
    .from("scenes")
    .select("tsid, title, order_index, story_images_v2")
    .eq("work_id", workId)
    .eq("chapter_number", chapterNumber)
    .lte("order_index", userProgress.readUpToOrderIndex)
    .order("order_index", { ascending: true })

  if (error) throw error

  const out: ChapterSceneSnippet[] = []
  const ordTarget = userProgress.readUpToOrderIndex
  const sceneTsid = userProgress.sceneTsid.trim()
  const rawLast = userProgress.readUpToStoryIndexLast

  for (const row of data ?? []) {
    if (!row || typeof row.tsid !== "string") continue
    const orderIdx = typeof row.order_index === "number" ? row.order_index : 0
    const slides = effectiveStorySlidesFromV2(row.story_images_v2)
    let revealedRaw: typeof slides

    if (orderIdx < ordTarget) {
      revealedRaw = slides
    } else if (row.tsid === sceneTsid) {
      const maxLast = slides.length > 0 ? slides.length - 1 : -1
      const clampedLast = Math.min(Math.max(rawLast, -1), maxLast)
      revealedRaw = sliceRevealedStorySlides(slides, clampedLast)
    } else {
      // `lte` query tip row that is not the declared current scene — do not inject captions.
      revealedRaw = []
    }

    out.push({
      tsid: row.tsid,
      title: typeof row.title === "string" ? row.title : "",
      order_index: orderIdx,
      revealedStorySlides: revealedRaw.map((s) => ({ caption: s.caption })),
    })
  }
  return out
}

async function embedQuery(query: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("embedQuery requires GEMINI_API_KEY")
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${encodeURIComponent(apiKey)}`

  const body = {
    model: "models/gemini-embedding-001",
    content: { parts: [{ text: query }] },
    outputDimensionality: RAG_EMBEDDING_DIM,
    taskType: "RETRIEVAL_QUERY",
  }

  const proxyUrl = process.env.HTTPS_PROXY
  const headers = { "Content-Type": "application/json" }
  const init: RequestInit & NodeFetchRequestInit = {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }

  let res: globalThis.Response
  try {
    if (proxyUrl) {
      init.agent = new HttpsProxyAgent(proxyUrl)
      const nodeRes = await nodeFetch(url, init as Parameters<typeof nodeFetch>[1])
      res = nodeRes as unknown as globalThis.Response
    } else {
      res = await fetch(url, init as RequestInit)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gemini embedContent fetch failed"
    throw new Error(msg)
  }

  const raw = await res.text()
  if (!res.ok) {
    throw new Error(`Gemini embedContent failed (${res.status}): ${raw.slice(0, 500)}`)
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error("Gemini embedContent returned non-JSON")
  }

  const values = parseGeminiEmbeddingValues(json)
  if (values.length !== RAG_EMBEDDING_DIM) {
    throw new Error(
      `Gemini embedding length ${values.length} !== expected ${RAG_EMBEDDING_DIM}`
    )
  }
  return values
}

function parseGeminiEmbeddingValues(json: unknown): number[] {
  if (!json || typeof json !== "object") return []
  const root = json as Record<string, unknown>

  const pickValues = (emb: unknown): number[] | null => {
    if (!emb || typeof emb !== "object") return null
    const v = (emb as { values?: unknown }).values
    if (!Array.isArray(v)) return null
    return v.map((x) => Number(x))
  }

  const single = pickValues(root.embedding)
  if (single) return single

  const embArr = root.embeddings
  if (Array.isArray(embArr) && embArr.length > 0) {
    const first = pickValues(embArr[0])
    if (first) return first
  }

  return []
}

async function resolveWorkId(
  supabase: SupabaseClient,
  workTsid: string
): Promise<string | null> {
  const { data: work, error: workError } = await supabase
    .from("works")
    .select("id")
    .eq("tsid", workTsid)
    .maybeSingle()

  if (workError) throw workError
  if (!work || typeof work.id !== "string") return null
  return work.id
}

/**
 * ADR-002 Step 1 — mandatory SQL safety gate (metadataPreFiltering).
 * Produces candidateSet: scene tsids the user is allowed to see.
 */
async function metadataPreFiltering(
  supabase: SupabaseClient,
  workId: string,
  userProgress: ProgressConfig
): Promise<string[]> {
  const ch = userProgress.readUpToChapter
  const ord = userProgress.readUpToOrderIndex

  // Lexicographic bound on SceneRow columns (chapter_number / order_index — not chapter_id).
  const orFilter = `chapter_number.lt.${ch},and(chapter_number.eq.${ch},order_index.lte.${ord})`

  const { data: rows, error: scenesError } = await supabase
    .from("scenes")
    .select("tsid")
    .eq("work_id", workId)
    .or(orFilter)

  if (scenesError) throw scenesError

  const candidateSet: string[] = []
  for (const row of rows ?? []) {
    if (row && typeof row.tsid === "string" && row.tsid) {
      candidateSet.push(row.tsid)
    }
  }
  return candidateSet
}

/**
 * Same-request dedupe for Server Components / RSC data loaders (React.cache + primitive args).
 * On cache hit, the returned object (including observability) is the snapshot from the first call.
 */
const retrieveScenesCached = cache(
  async (
    query: string,
    workTsid: string,
    readUpToChapter: number,
    readUpToOrderIndex: number,
    sceneTsid: string,
    readUpToStoryIndexLast: number
  ): Promise<RetrieveScenesResult> => {
    return retrieveScenesUncached(query, {
      workTsid,
      readUpToChapter,
      readUpToOrderIndex,
      sceneTsid,
      readUpToStoryIndexLast,
    })
  }
)

/**
 * Serial pipeline: resolve work → metadataPreFiltering → candidateSet → embedQuery → match_scenes(..., candidate_tsids).
 * RPC is always invoked for a valid work (including empty candidateSet). Unknown workTsid throws.
 */
function assertRerankResultsWithinCandidateSet(
  results: RetrievedScene[],
  candidateTsids: string[]
): void {
  const allowed = new Set(candidateTsids)
  for (const row of results) {
    if (!allowed.has(row.tsid)) {
      throw new InvariantViolationError(
        `post-rerank tsid ${row.tsid} not in SQL candidateSet (${candidateTsids.length} candidates)`
      )
    }
  }
}

async function retrieveScenesUncached(
  query: string,
  userProgress: ProgressConfig
): Promise<RetrieveScenesUncachedResult> {
  const t0 = performance.now()
  const supabase = getRetrievalSupabase()

  const workId = await resolveWorkId(supabase, userProgress.workTsid)
  if (!workId) {
    throw new Error(`retrieveScenes: unknown workTsid ${userProgress.workTsid}`)
  }

  // --- metadataPreFiltering: SQL mandatory gate → candidateSet ---
  const candidateSet = await metadataPreFiltering(supabase, workId, userProgress)
  const candidateSetSize = candidateSet.length

  // --- downstream semantic reranking: single RPC over candidateSet (ADR-002) ---
  const queryEmbedding = await embedQuery(query)

  const rpcArgs: MatchScenesRpcArgs = {
    query_embedding: queryEmbedding,
    work_id_filter: workId,
    candidate_tsids: candidateSet,
    match_count: DEFAULT_MATCH_COUNT,
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(MATCH_SCENES_RPC, rpcArgs)

  if (rpcError) {
    throw rpcError
  }

  const rows = (rpcData ?? []) as MatchScenesRpcRow[]
  const results: RetrievedScene[] = await mergeScenesTableSummaries(
    supabase,
    rows.map(rowToRetrievedScene)
  )
  const rerankScores = rows.map((row) => extractRerankScore(row))

  const retrievalLatency = performance.now() - t0

  return {
    results,
    candidateTsids: candidateSet,
    observability: {
      candidateSetSize,
      retrievalLatency,
      rerankScores,
    },
  }
}

export async function retrieveScenes(
  query: string,
  userProgress: ProgressConfig
): Promise<RetrieveScenesResult> {
  const out = await retrieveScenesCached(
    query,
    userProgress.workTsid,
    userProgress.readUpToChapter,
    userProgress.readUpToOrderIndex,
    userProgress.sceneTsid,
    userProgress.readUpToStoryIndexLast
  )
  return out
}

/**
 * Scene Assistant ingress: serial retrieval + chapterScenes authorization + semantic SHA-256 gate.
 * Only chapterScenes[].revealedStorySlides[].caption bytes participate in the production oracle.
 * RetrievedScene summaries / rerank metadata are excluded from story oracle hashing.
 */
export async function retrieveVerifiedAssistantContext(
  query: string,
  userProgress: ProgressConfig,
  chapterNumber: number
): Promise<VerifiedAssistantContext> {
  const normalizedUserQuery = normalizeQueryForFingerprint(query)
  const stableFingerprint = buildStableRequestFingerprint({
    sceneTsid: userProgress.sceneTsid,
    chapterNumber,
    readUpToStoryIndexLast: userProgress.readUpToStoryIndexLast,
    normalizedUserQuery,
  })
  const requestId = `${stableFingerprint}:${randomUUID()}`

  const [retrievalOut, chapterScenes] = await Promise.all([
    retrieveScenesUncached(query, userProgress),
    fetchChapterScenesWithinProgress(userProgress, chapterNumber),
  ])

  const results = retrievalOut.results.filter(
    (r) => r.tsid !== userProgress.sceneTsid
  )
  assertRerankResultsWithinCandidateSet(results, retrievalOut.candidateTsids)

  const collected = collectAuthorizedSemanticBytes(chapterScenes)

  const storyOracle = verifyProductionStoryOracle({
    authorizedChunks: collected.chunks,
    authorizedSemanticBytes: collected.authorizedSemanticBytes,
    requestId,
    stableFingerprint,
  })

  const currentSnippet = chapterScenes.find((s) => s.tsid === userProgress.sceneTsid)
  const currentSceneRevealedXml = buildCurrentSceneRevealedXml(
    currentSnippet?.revealedStorySlides ?? []
  )
  const chapterScenesXml = buildChapterScenesXml(chapterScenes)

  return {
    requestId,
    stableFingerprint,
    results,
    chapterScenes,
    storyOracle,
    currentSceneRevealedXml,
    chapterScenesXml,
    observability: retrievalOut.observability,
  }
}
