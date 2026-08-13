"use client"

import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import {
  abortGenerationController,
  applyAssistantDelta,
  historyTurnsForRequest,
  isAbortError,
  markAssistantTerminal,
  shouldAcceptAssistantDelta,
  type AssistantChatMessage,
  type AssistantGenerationPhase,
} from "@/lib/assistant-generation-lifecycle"
import { messages as locale } from "@/lib/locale"

export interface ReadingRouteAssistantContext {
  /** Business scene id (`scenes.tsid`); must match `userProgress.sceneTsid`. */
  tsid: string
  /** Raree 作品展示名，供模型把握语气与世界观边界；勿写死某一 IP。 */
  workTitle: string
  title: string
  chapter_number: number
  chapter_title: string | null
  location: string
  characters: string[]
  summary: string
}

/** Mirrors ProgressConfig in retrieval (client-safe shape, no server imports). */
export interface ReadingRouteAssistantUserProgress {
  workTsid: string
  readUpToChapter: number
  readUpToOrderIndex: number
  sceneTsid: string
  /**
   * Last revealed story slide index (0-based, inclusive), aligned with ImageReel / filtered `story_images_v2`.
   * `-1` when there are no slides.
   */
  readUpToStoryIndexLast: number
}

interface ReadingRouteAssistantProps {
  sceneContext: ReadingRouteAssistantContext
  userProgress: ReadingRouteAssistantUserProgress
}

function parseUiMessageSseEvent(rawEvent: string): { delta?: string; error?: string } {
  const dataLines = rawEvent
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())

  if (dataLines.length === 0) return {}

  const payload = dataLines.join("\n")
  if (!payload || payload === "[DONE]") return {}

  try {
    const json = JSON.parse(payload) as { type?: string; delta?: string; errorText?: string }
    if (json.type === "error" && typeof json.errorText === "string") {
      return { error: json.errorText }
    }
    if (json.type === "text-delta" && typeof json.delta === "string") {
      return { delta: json.delta }
    }
  } catch {
    // ignore malformed chunks
  }
  return {}
}

export default function ReadingRouteAssistant({ sceneContext, userProgress }: ReadingRouteAssistantProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<AssistantChatMessage[]>([])
  const [phase, setPhase] = useState<AssistantGenerationPhase>("idle")
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sendingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const phaseRef = useRef<AssistantGenerationPhase>("idle")
  const generationIdRef = useRef(0)

  const setGenerationPhase = (next: AssistantGenerationPhase) => {
    phaseRef.current = next
    setPhase(next)
  }

  useEffect(() => {
    if (!open) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, open, phase])

  useEffect(() => {
    return () => {
      abortGenerationController(abortRef.current)
      abortRef.current = null
    }
  }, [])

  function stopActiveGeneration() {
    if (phaseRef.current !== "streaming") return
    const generationId = generationIdRef.current
    setGenerationPhase("cancelled")
    setError(null)
    setMessages((m) => markAssistantTerminal(m, generationId, "cancelled", ""))
    abortGenerationController(abortRef.current)
  }

  function closePanel() {
    if (phaseRef.current === "streaming") {
      stopActiveGeneration()
    }
    setOpen(false)
  }

  async function send() {
    const question = input.trim()
    if (!question || sendingRef.current || phaseRef.current === "streaming") return
    sendingRef.current = true

    const apiMessages = [
      ...historyTurnsForRequest(messages),
      { role: "user" as const, content: question },
    ]

    const controller = new AbortController()
    abortRef.current = controller
    const generationId = generationIdRef.current + 1
    generationIdRef.current = generationId
    setGenerationPhase("streaming")

    setInput("")
    setError(null)
    setMessages((m) => [
      ...m.filter((x) => !(x.role === "assistant" && x.status === "streaming")),
      { role: "user", content: question },
      { role: "assistant", content: "", status: "streaming", generationId },
    ])

    let acc = ""
    try {
      const res = await fetch("/api/scene-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          sceneContext,
          userProgress,
        }),
        signal: controller.signal,
      })

      if (!shouldAcceptAssistantDelta({
        phase: phaseRef.current,
        activeGenerationId: generationIdRef.current,
        eventGenerationId: generationId,
      })) {
        return
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText)
        throw new Error(errText || locale.assistant.errorRequestFailed(res.status))
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error(locale.assistant.errorNoBody)

      const decoder = new TextDecoder()
      let lineBuffer = ""
      let eventDataLines: string[] = []

      const flushEvent = () => {
        if (eventDataLines.length === 0) return
        const event = eventDataLines.join("\n")
        eventDataLines = []
        const parsed = parseUiMessageSseEvent(event)
        if (parsed.error) {
          throw new Error(parsed.error)
        }
        if (
          parsed.delta &&
          shouldAcceptAssistantDelta({
            phase: phaseRef.current,
            activeGenerationId: generationIdRef.current,
            eventGenerationId: generationId,
          })
        ) {
          acc += parsed.delta
          const snapshot = acc
          setMessages((m) => applyAssistantDelta(m, generationId, snapshot))
        }
      }

      const processSseChunk = (text: string) => {
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

      while (
        shouldAcceptAssistantDelta({
          phase: phaseRef.current,
          activeGenerationId: generationIdRef.current,
          eventGenerationId: generationId,
        })
      ) {
        const { done, value } = await reader.read()
        if (done) {
          processSseChunk(decoder.decode())
          const trailingLine = lineBuffer.replace(/\r$/, "")
          if (trailingLine.startsWith("data:")) {
            eventDataLines.push(trailingLine)
          }
          lineBuffer = ""
          flushEvent()
          break
        }
        processSseChunk(decoder.decode(value, { stream: true }))
      }

      if (phaseRef.current === "cancelled" && generationIdRef.current === generationId) {
        setMessages((m) => markAssistantTerminal(m, generationId, "cancelled", acc))
        return
      }

      if (
        shouldAcceptAssistantDelta({
          phase: phaseRef.current,
          activeGenerationId: generationIdRef.current,
          eventGenerationId: generationId,
        })
      ) {
        setGenerationPhase("completed")
        setMessages((m) => markAssistantTerminal(m, generationId, "completed", acc))
      }
    } catch (e) {
      const aborted =
        isAbortError(e) ||
        controller.signal.aborted ||
        phaseRef.current === "cancelled"
      if (aborted) {
        if (phaseRef.current !== "cancelled") {
          setGenerationPhase("cancelled")
        }
        setError(null)
        setMessages((m) => markAssistantTerminal(m, generationId, "cancelled", acc))
        return
      }
      if (generationIdRef.current !== generationId) return
      const msg = e instanceof Error ? e.message : locale.assistant.errorGeneric
      setGenerationPhase("failed")
      setError(msg)
      setMessages((m) => markAssistantTerminal(m, generationId, "failed", acc))
    } finally {
      if (generationIdRef.current === generationId) {
        sendingRef.current = false
        if (abortRef.current === controller) {
          abortRef.current = null
        }
      }
    }
  }

  const streaming = phase === "streaming"

  return (
    <>
      {open && (
        /* Viewport-fixed: right/bottom align with rs-scene-right-rail edge; if rail inset/width changes, keep in sync. */
        <div
          className="fixed z-[20] flex max-h-[min(500px,calc(100vh-140px))] w-[380px] max-w-[calc(100vw-64px)] flex-col overflow-hidden rounded-xl border border-[#c8b89a] shadow-lg"
          style={{
            right: 32,
            bottom: 96,
            left: "auto",
            transform: "none",
            background: "rgba(245, 240, 232, 0.95)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[#c8b89a]/60 px-3 py-2">
            <h2 className="text-[11px] font-medium uppercase tracking-widest text-[#8b1a1a]">
              {locale.assistant.panelTitle}
            </h2>
            <button
              type="button"
              onClick={() => closePanel()}
              className="rounded p-1 text-sm text-[#6b4c35] hover:bg-[#c8b89a]/40 hover:text-[#2c1810]"
              aria-label={locale.assistant.closeAria}
            >
              ×
            </button>
          </div>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
          >
            <div className="flex min-h-full flex-col justify-end gap-2">
              {messages.length === 0 && (
                <p className="text-center text-xs text-[#6b4c35]">
                  {locale.assistant.emptyState}
                </p>
              )}
              {messages.map((msg, i) => (
                <div
                  key={msg.role === "assistant" && msg.generationId != null ? `a-${msg.generationId}` : `m-${i}`}
                  className={`max-w-[92%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "ml-auto bg-[#8b1a1a] text-[#f5f0e8]"
                      : "mr-auto bg-[#ede8dc] text-[#2c1810]"
                  }`}
                >
                  {msg.role === "user" ? (
                    <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                  ) : (
                    <>
                      <div
                        className="break-words [&_strong]:font-semibold [&_b]:font-semibold [&_em]:italic [&_p]:my-0 [&_p+p]:mt-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_code]:rounded [&_code]:bg-[#c8b89a]/40 [&_code]:px-1 [&_code]:text-[0.85em]"
                      >
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      {msg.status === "streaming" && (
                        <span
                          className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-[#2c1810] align-[-0.15em]"
                          aria-hidden
                        />
                      )}
                      {msg.status === "cancelled" && (
                        <p className="mt-1 text-[11px] text-[#6b4c35]">{locale.assistant.stoppedLabel}</p>
                      )}
                    </>
                  )}
                </div>
              ))}
              {error && phase === "failed" && (
                <p className="text-center text-xs text-[#8b1a1a]">{error}</p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 gap-2 border-t border-[#c8b89a]/60 p-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (!streaming) {
                    void send().catch((error) => {
                      if (!isAbortError(error)) console.error(error)
                    })
                  }
                }
              }}
              placeholder={locale.assistant.inputPlaceholder}
              disabled={streaming}
              className="min-w-0 flex-1 rounded-md border border-[#c8b89a] bg-[#f5f0e8]/80 px-3 py-2 text-sm text-[#2c1810] placeholder:text-[#6b4c35]/70 outline-none focus:border-[#8b1a1a]"
            />
            {streaming ? (
              <button
                type="button"
                onClick={stopActiveGeneration}
                className="shrink-0 rounded-md border border-[#6b4c35] bg-[#6b4c35] px-3 py-2 text-sm text-[#f5f0e8] hover:bg-[#2c1810]"
                aria-label={locale.assistant.stopAria}
              >
                {locale.assistant.stop}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void send().catch((error) => {
                    if (!isAbortError(error)) console.error(error)
                  })
                }}
                disabled={!input.trim()}
                className="shrink-0 rounded-md border border-[#8b1a1a] bg-[#8b1a1a] px-3 py-2 text-sm text-[#f5f0e8] hover:bg-[#6b1414] disabled:opacity-50"
              >
                {locale.assistant.send}
              </button>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (open) closePanel()
          else setOpen(true)
        }}
        className="relative z-[20] flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-[#f5f0e8] shadow-md transition hover:brightness-110"
        style={{
          background: "#8b1a1a",
        }}
        aria-label={locale.assistant.openFabAria}
      >
        ✦
      </button>
    </>
  )
}
