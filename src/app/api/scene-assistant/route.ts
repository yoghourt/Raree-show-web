import { NextRequest } from "next/server"
import fetch, { type RequestInit as NodeFetchRequestInit } from "node-fetch"

function extractGeminiText(data: unknown): string {
  if (!data || typeof data !== "object") return ""
  const d = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text
  return typeof text === "string" ? text : ""
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return new Response("Missing GEMINI_API_KEY in environment.", { status: 500 })
  }

  let body: { question?: string; sceneContext?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return new Response("Invalid JSON body", { status: 400 })
  }

  const { question, sceneContext } = body
  if (!question || typeof question !== "string") {
    return new Response("Missing question", { status: 400 })
  }
  if (!sceneContext || typeof sceneContext !== "object") {
    return new Response("Missing sceneContext", { status: 400 })
  }

  const ctx = sceneContext as {
    title: string
    book: number
    chapter: number
    location: string
    characters: string[]
    summary: string
  }

  const prompt = `You are a knowledgeable guide for "A Song of Ice and Fire".

Current scene:
- Title: ${ctx.title}
- Book ${ctx.book}, Chapter ${ctx.chapter}
- Location: ${ctx.location}
- Characters: ${ctx.characters.join(", ")}
- Summary: ${ctx.summary}

Question: ${question}

Answer in maximum 2 sentences. Be concise and direct.`

  // Only use a proxy when HTTPS_PROXY is set (e.g. local dev). Vercel has no proxy.
  const proxyUrl = process.env.HTTPS_PROXY

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(apiKey)}`

  const fetchOptions: NodeFetchRequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  }

  if (proxyUrl) {
    const { HttpsProxyAgent } = await import("https-proxy-agent")
    fetchOptions.agent = new HttpsProxyAgent(proxyUrl)
  }

  let response: Awaited<ReturnType<typeof fetch>>
  try {
    response = await fetch(url, fetchOptions)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed"
    return new Response(msg, { status: 502 })
  }

  const raw = await response.text()
  let data: unknown
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    return new Response(raw || "Invalid JSON from Gemini", { status: 502 })
  }

  if (!response.ok) {
    const errMsg =
      typeof data === "object" && data !== null && "error" in data
        ? JSON.stringify((data as { error: unknown }).error)
        : raw
    return new Response(errMsg || response.statusText, { status: response.status })
  }

  const text = extractGeminiText(data)
  if (!text) {
    return new Response("Empty response from model", { status: 502 })
  }

  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
