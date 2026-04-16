import { NextRequest } from "next/server"
import { Readable } from "node:stream"
import nodeFetch, { type RequestInit as NodeFetchRequestInit } from "node-fetch"
import { HttpsProxyAgent } from "https-proxy-agent"

/** node-fetch 的 body 是 Node Readable，没有 getReader；原生 fetch 的 body 是 Web ReadableStream。 */
function getBodyReader(body: NonNullable<globalThis.Response["body"]>) {
  if (typeof body.getReader === "function") {
    return body.getReader()
  }
  return Readable.toWeb(body as unknown as import("stream").Readable).getReader()
}

function extractGeminiText(data: unknown): string {
  if (!data || typeof data !== "object") return ""
  const d = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const texts: string[] = []
  for (const candidate of d.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (typeof part.text === "string" && part.text.length > 0) {
        texts.push(part.text)
      }
    }
  }
  return texts.join("")
}

function parseSseEvent(rawEvent: string): string | null {
  // SSE 允许同一事件由多行 data: 组成，需拼接后再解析 JSON。
  const dataLines = rawEvent
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())

  if (dataLines.length === 0) return null

  const payload = dataLines.join("\n")
  if (!payload || payload === "[DONE]") return null

  try {
    const json = JSON.parse(payload)
    return extractGeminiText(json) || null
  } catch {
    return null
  }
}
export async function POST(req: NextRequest) {
  // 1. 参数校验
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
  // 2. 构造 prompt
  const ctx = sceneContext as {
    title: string
    chapter_number: number
    chapter_title: string | null
    location: string
    characters: string[]
    summary: string
  }

  const chapterLine =
    ctx.chapter_title != null && ctx.chapter_title !== ""
      ? `Chapter ${ctx.chapter_number} · ${ctx.chapter_title}`
      : `Chapter ${ctx.chapter_number}`

  const prompt = `You are a knowledgeable guide for "A Song of Ice and Fire".

Current scene:
- Title: ${ctx.title}
- ${chapterLine}
- Location: ${ctx.location}
- Characters: ${ctx.characters.join(", ")}
- Summary: ${ctx.summary}

Question: ${question}

Answer in maximum 2 sentences. Be concise and direct.`

  // Only use a proxy when HTTPS_PROXY is set (e.g. local dev). Vercel has no proxy.
  const proxyUrl = process.env.HTTPS_PROXY

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`

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
  // 3. 调 Gemini 的 streamGenerateContent端点
    let response: globalThis.Response
    try {
      const proxyUrl = process.env.HTTPS_PROXY
      if (proxyUrl) {
        const agent = new HttpsProxyAgent(proxyUrl)
        const nodeFetchOptions = { ...fetchOptions, agent }
        const nodeRes = await nodeFetch(url, nodeFetchOptions as Parameters<typeof nodeFetch>[1])
        response = nodeRes as unknown as globalThis.Response
      } else {
        response = await fetch(url, fetchOptions as RequestInit)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fetch failed"
      return new Response(msg, { status: 502 })
    }

  const stream = new ReadableStream({
    async start(controller) {
      if (!response.body) {
        controller.error(new Error("No response body from Gemini"))
        return
      }
      const reader = getBodyReader(response.body)
      const decoder = new TextDecoder()
      const encoder = new TextEncoder()
      let lineBuffer = ""
      let eventDataLines: string[] = []
      try {
        const flushEvent = () => {
          if (eventDataLines.length === 0) return
          const event = eventDataLines.join("\n")
          const geminiText = parseSseEvent(event)
          if (geminiText) {
            controller.enqueue(encoder.encode(`data: ${geminiText}\n\n`))
          }
          eventDataLines = []
        }

        const processChunkText = (text: string) => {
          lineBuffer += text
          const lines = lineBuffer.split("\n")
          lineBuffer = lines.pop() ?? ""

          for (const rawLine of lines) {
            const line = rawLine.replace(/\r$/, "")
            if (line === "") {
              flushEvent()
              continue
            }
            if (line.startsWith("data:")) {
              eventDataLines.push(line)
            }
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            processChunkText(decoder.decode())
            const trailingLine = lineBuffer.replace(/\r$/, "")
            if (trailingLine.startsWith("data:")) {
              eventDataLines.push(trailingLine)
            }
            lineBuffer = ""
            flushEvent()
            break
          }
          processChunkText(decoder.decode(value, { stream: true }))
        }
        // 结束时
        controller.close()
        return
      } catch (e) {
        controller.error(e)
        return
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }
  })
}
