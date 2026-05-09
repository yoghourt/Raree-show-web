import { Readable } from "node:stream"
import nodeFetch from "node-fetch"
import type { RequestInit as NodeFetchRequestInit } from "node-fetch"
import { HttpsProxyAgent } from "https-proxy-agent"

let memo: typeof fetch | undefined

function nodeFetchResponseToWebResponse(res: Awaited<ReturnType<typeof nodeFetch>>): Response {
  const webHeaders = new Headers()
  res.headers.forEach((value, name) => {
    webHeaders.append(name, value)
  })

  const status = res.status
  const statusText = res.statusText

  const nodeBody = res.body
  if (nodeBody == null) {
    return new Response(null, { status, statusText, headers: webHeaders })
  }

  // node-fetch uses Node streams; AI SDK expects Web Streams (`body.pipeThrough`).
  const webStream = Readable.toWeb(nodeBody as Readable)
  // Bridge Node `stream/web` vs DOM `ReadableStream` typings (same at runtime).
  return new Response(webStream as unknown as ReadableStream<Uint8Array>, {
    status,
    statusText,
    headers: webHeaders,
  })
}

/**
 * `fetch` for Gemini HTTP calls (`@ai-sdk/google`).
 * When `HTTPS_PROXY` is set (local dev), matches `embedQuery` in `src/services/retrieval.ts`.
 * On Vercel, omit `HTTPS_PROXY` and use default `globalThis.fetch`.
 */
export function getFetchForGoogleGenerativeAI(): typeof fetch {
  if (memo) return memo

  const proxyUrl = process.env.HTTPS_PROXY?.trim()
  if (!proxyUrl) {
    memo = globalThis.fetch.bind(globalThis)
    return memo
  }

  const agent = new HttpsProxyAgent(proxyUrl)

  memo = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : String(input)

    let method = init?.method
    let headers = init?.headers as NodeFetchRequestInit["headers"]
    let body = init?.body as NodeFetchRequestInit["body"]
    let signal = init?.signal as AbortSignal | undefined

    if (input instanceof Request) {
      method = method ?? input.method
      if (headers == null) {
        headers = Object.fromEntries(input.headers.entries())
      }
      if (body == null && input.method !== "GET" && input.method !== "HEAD") {
        const buf = await input.clone().arrayBuffer()
        body = Buffer.from(buf)
      }
      signal = signal ?? input.signal
    }

    const res = await nodeFetch(url, {
      method,
      headers,
      body,
      signal,
      agent,
    } as NodeFetchRequestInit)

    return nodeFetchResponseToWebResponse(res)
  }

  return memo
}
