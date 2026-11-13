"use client"

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
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
import { en } from "@/lib/locale/en"
import { localizeKnownError } from "@/lib/locale/errors"
import { useLocale } from "@/lib/locale/provider"
import {
  layoutReaderGuide,
  READER_GUIDE_OBSTACLES,
  READER_GUIDE_TOOLTIP_OBSTACLES,
} from "@/lib/reader-guide-placement"

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
  guideCueVisible: boolean
  onDismissGuideCue: () => void
}

function GuideMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="1.35" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M8 1.15 L8.9 6.15 L8 5.35 L7.1 6.15 Z M14.85 8 L9.85 8.9 L10.65 8 L9.85 7.1 Z M8 14.85 L7.1 9.85 L8 10.65 L8.9 9.85 Z M1.15 8 L6.15 7.1 L5.35 8 L6.15 8.9 Z"
        fill="currentColor"
      />
    </svg>
  )
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

export default function ReadingRouteAssistant({
  sceneContext,
  userProgress,
  guideCueVisible,
  onDismissGuideCue,
}: ReadingRouteAssistantProps) {
  const { locale, messages: copy } = useLocale()
  const guideTitleId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [anchorOffset, setAnchorOffset] = useState({ right: 0, bottom: 0 })
  const [tooltipBox, setTooltipBox] = useState({ width: 266, right: 0, lift: 0, pointer: 22 })
  const [panelMaxHeight, setPanelMaxHeight] = useState<number | null>(null)
  const [guidePlaced, setGuidePlaced] = useState(false)
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
        throw new Error(errText || en.assistant.errorRequestFailed(res.status))
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error(en.assistant.errorNoBody)

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
      const msg = e instanceof Error ? e.message : en.assistant.errorGeneric
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

  useLayoutEffect(() => {
    const root = rootRef.current
    const cta = ctaRef.current
    if (!root || !cta) return

    const place = () => {
      try {
        const slot = root.getBoundingClientRect()
        if (slot.width < 1 || slot.height < 1 || cta.offsetWidth < 1) return
        const next = layoutReaderGuide({
          slot,
          cta,
          tooltip: guideCueVisible ? tooltipRef.current : null,
        })
        setAnchorOffset((prev) =>
          prev.right === next.anchorRight && prev.bottom === next.anchorBottom
            ? prev
            : { right: next.anchorRight, bottom: next.anchorBottom },
        )
        setTooltipBox((prev) =>
          prev.width === next.tooltipWidth &&
          prev.right === next.tooltipRight &&
          prev.lift === next.tooltipLift &&
          prev.pointer === next.tooltipPointerRight
            ? prev
            : {
                width: next.tooltipWidth,
                right: next.tooltipRight,
                lift: next.tooltipLift,
                pointer: next.tooltipPointerRight,
              },
        )
        setPanelMaxHeight((prev) => (prev === next.panelMaxHeight ? prev : next.panelMaxHeight))
        setGuidePlaced(true)
      } catch {
        // Placement is cosmetic. A measurement failure leaves the CSS fallback in place.
      }
    }

    place()
    window.addEventListener("resize", place)
    window.visualViewport?.addEventListener("resize", place)
    const observer = new ResizeObserver(() => place())
    observer.observe(cta)
    const rail = root.closest(".rs-scene-right-rail")
    if (rail) observer.observe(rail)
    for (const selector of [...READER_GUIDE_OBSTACLES, ...READER_GUIDE_TOOLTIP_OBSTACLES]) {
      document.querySelectorAll(selector).forEach((node) => observer.observe(node))
    }
    return () => {
      window.removeEventListener("resize", place)
      window.visualViewport?.removeEventListener("resize", place)
      observer.disconnect()
    }
  }, [guideCueVisible, locale, copy.readerGuide.button, copy.readerGuide.onboarding.description])

  function focusGuideCta() {
    ctaRef.current?.focus()
  }

  function handleGuideCtaClick() {
    if (guideCueVisible) onDismissGuideCue()
    if (open) closePanel()
    else setOpen(true)
  }

  function handleDismissGuideCue() {
    onDismissGuideCue()
    focusGuideCta()
  }

  return (
    <div ref={rootRef} className="reader-guide-root" style={{ pointerEvents: "none" }}>
      <div
        className="reader-guide-anchor"
        style={
          guidePlaced
            ? { right: anchorOffset.right, bottom: anchorOffset.bottom, pointerEvents: "none" }
            : { pointerEvents: "none" }
        }
      >
      {open && (
        /* Anchored to the guide CTA. Negative right keeps the panel's right edge on the rail. */
        <div
          className="reader-guide-panel z-[3] flex w-[380px] max-w-[calc(100vw-48px)] flex-col overflow-hidden"
          style={{
            right: -anchorOffset.right,
            maxHeight: panelMaxHeight ?? undefined,
            fontFamily:
              locale === "zh-CN"
                ? '"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif'
                : 'Georgia, "Times New Roman", serif',
          }}
        >
          <div className="reader-guide-panel-header">
            <div className="reader-guide-panel-heading">
              <GuideMark size={16} />
              <h2
                className="reader-guide-panel-title"
                style={{ letterSpacing: locale === "zh-CN" ? 0 : "0.04em" }}
              >
                {copy.assistant.panelTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => closePanel()}
              className="reader-guide-panel-close"
              aria-label={copy.assistant.closeAria}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div ref={scrollRef} className="reader-guide-panel-log">
            <div className="reader-guide-panel-log-inner">
              {messages.length === 0 && (
                <div className="reader-guide-panel-empty">
                  <GuideMark size={18} />
                  <p>{copy.assistant.emptyState}</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={msg.role === "assistant" && msg.generationId != null ? `a-${msg.generationId}` : `m-${i}`}
                  className={
                    msg.role === "user"
                      ? "reader-guide-msg reader-guide-msg-user"
                      : "reader-guide-msg reader-guide-msg-assistant"
                  }
                >
                  {msg.role === "user" ? (
                    <span className="reader-guide-msg-body">{msg.content}</span>
                  ) : (
                    <>
                      <div className="reader-guide-msg-body">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      {msg.status === "streaming" && (
                        <span className="reader-guide-stream-caret" aria-hidden />
                      )}
                      {msg.status === "cancelled" && (
                        <p className="reader-guide-msg-note">{copy.assistant.stoppedLabel}</p>
                      )}
                    </>
                  )}
                </div>
              ))}
              {error && phase === "failed" && (
                <p className="reader-guide-panel-error">{localizeKnownError(error, copy)}</p>
              )}
            </div>
          </div>

          <div className="reader-guide-panel-composer">
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
              placeholder={copy.assistant.inputPlaceholder}
              disabled={streaming}
              className="reader-guide-panel-input"
            />
            {streaming ? (
              <button
                type="button"
                onClick={stopActiveGeneration}
                className="reader-guide-panel-action"
                aria-label={copy.assistant.stopAria}
              >
                {copy.assistant.stop}
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
                className="reader-guide-panel-action"
              >
                {copy.assistant.send}
              </button>
            )}
          </div>
        </div>
      )}

      {guideCueVisible ? (
        <div
          ref={tooltipRef}
          className="reader-guide-tooltip"
          role="note"
          aria-labelledby={guideTitleId}
          style={{
            width: tooltipBox.width,
            maxWidth: tooltipBox.width,
            right: tooltipBox.right,
            bottom: `calc(100% + ${12 + tooltipBox.lift}px)`,
            fontFamily:
              locale === "zh-CN"
                ? '"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif'
                : 'Georgia, "Times New Roman", serif',
          }}
        >
          <button
            type="button"
            className="reader-guide-tooltip-close"
            aria-label={copy.readerGuide.onboarding.dismiss}
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleDismissGuideCue}
          >
            <span aria-hidden="true">×</span>
          </button>
          <div className="reader-guide-tooltip-heading">
            <GuideMark size={18} />
            <p id={guideTitleId} className="reader-guide-tooltip-title">
              {copy.readerGuide.onboarding.title}
            </p>
          </div>
          <p className="reader-guide-tooltip-body">{copy.readerGuide.onboarding.description}</p>
          <p className="reader-guide-tooltip-support">{copy.readerGuide.onboarding.supportingText}</p>
          <span
            className="reader-guide-tooltip-pointer"
            style={{ right: tooltipBox.pointer }}
            aria-hidden="true"
          />
        </div>
      ) : null}

      <button
        ref={ctaRef}
        type="button"
        className="reader-guide-cta"
        aria-label={copy.readerGuide.buttonAriaLabel}
        onClick={handleGuideCtaClick}
        style={{
          fontFamily:
            locale === "zh-CN"
              ? '"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif'
              : 'Georgia, "Times New Roman", serif',
          letterSpacing: locale === "zh-CN" ? 0 : "0.04em",
        }}
      >
        <span className="reader-guide-rivet reader-guide-rivet-left" aria-hidden="true" />
        <span className="reader-guide-rivet reader-guide-rivet-right" aria-hidden="true" />
        <GuideMark size={20} />
        <span className="reader-guide-cta-label">{copy.readerGuide.button}</span>
        <span className="reader-guide-cta-arrow" aria-hidden="true">
          ›
        </span>
      </button>
      </div>

      <style jsx>{`
        .reader-guide-root {
          position: absolute;
          inset: 0;
          overflow: visible;
        }

        .reader-guide-anchor {
          position: absolute;
          right: 0;
          bottom: env(safe-area-inset-bottom, 0px);
          z-index: 2;
          width: max-content;
          max-width: calc(100vw - 24px);
          overflow: visible;
        }

        .reader-guide-panel {
          position: absolute;
          bottom: calc(100% + 12px);
          left: auto;
          transform: none;
          z-index: 3;
          box-sizing: border-box;
          max-height: min(500px, calc(100vh - 140px));
          border: 1px solid var(--rs-gold);
          border-radius: 4px;
          background: linear-gradient(180deg, #3d2816 0%, #24160c 42%, #140c07 100%);
          box-shadow:
            inset 0 1px 0 rgba(255, 236, 196, 0.18),
            inset 0 0 0 1px rgba(42, 26, 14, 0.65),
            0 18px 36px rgba(0, 0, 0, 0.55),
            0 0 16px rgba(200, 169, 110, 0.14);
          color: var(--rs-text);
          pointer-events: auto;
        }

        .reader-guide-panel-header {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 10px 10px 10px 14px;
          border-bottom: 1px solid rgba(200, 169, 110, 0.45);
          background: linear-gradient(180deg, #2a1a0e 0%, #1a0e08 100%);
        }

        .reader-guide-panel-heading {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 8px;
          color: #e7d3a1;
        }

        .reader-guide-panel-title {
          margin: 0;
          min-width: 0;
          color: #f3e6c4;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.35;
        }

        .reader-guide-panel-close {
          display: inline-flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: 0;
          border-radius: 4px;
          background: transparent;
          color: var(--rs-gold);
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
        }

        .reader-guide-panel-close:hover {
          background: rgba(200, 169, 110, 0.14);
          color: #f3e6c4;
        }

        .reader-guide-panel-log {
          min-height: 112px;
          flex: 1 1 auto;
          overflow-y: auto;
          background: #120b06;
          scrollbar-width: thin;
          scrollbar-color: rgba(200, 169, 110, 0.45) transparent;
        }

        .reader-guide-panel-log-inner {
          display: flex;
          min-height: 100%;
          flex-direction: column;
          justify-content: flex-end;
          gap: 8px;
          padding: 12px;
        }

        .reader-guide-panel-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin: auto;
          max-width: 28em;
          color: rgba(232, 213, 163, 0.78);
          text-align: center;
        }

        .reader-guide-panel-empty p {
          margin: 0;
          font-size: 13.5px;
          line-height: 1.55;
        }

        .reader-guide-msg {
          box-sizing: border-box;
          max-width: 92%;
          padding: 8px 10px;
          border-radius: 4px;
          font-size: 14px;
          line-height: 1.55;
        }

        .reader-guide-msg-user {
          margin-left: auto;
          border: 1px solid rgba(231, 211, 161, 0.55);
          background: linear-gradient(180deg, #6a4a28 0%, #4a3018 100%);
          color: #f6edd8;
        }

        .reader-guide-msg-assistant {
          margin-right: auto;
          border: 1px solid rgba(200, 169, 110, 0.22);
          background: rgba(61, 36, 16, 0.88);
          color: var(--rs-text);
        }

        .reader-guide-msg-body {
          overflow-wrap: anywhere;
        }

        .reader-guide-msg-user .reader-guide-msg-body {
          white-space: pre-wrap;
        }

        .reader-guide-msg-body :global(p) {
          margin: 0;
        }

        .reader-guide-msg-body :global(p + p) {
          margin-top: 0.35em;
        }

        .reader-guide-msg-body :global(ul),
        .reader-guide-msg-body :global(ol) {
          margin: 0.35em 0;
          padding-left: 1.1em;
        }

        .reader-guide-msg-body :global(ul) {
          list-style: disc;
        }

        .reader-guide-msg-body :global(ol) {
          list-style: decimal;
        }

        .reader-guide-msg-body :global(strong),
        .reader-guide-msg-body :global(b) {
          font-weight: 600;
        }

        .reader-guide-msg-body :global(em) {
          font-style: italic;
        }

        .reader-guide-msg-body :global(a) {
          color: var(--rs-gold);
        }

        .reader-guide-msg-body :global(code) {
          border-radius: 2px;
          background: rgba(0, 0, 0, 0.35);
          padding: 0 4px;
          color: #f3e6c4;
          font-size: 0.85em;
        }

        .reader-guide-msg-note {
          margin: 6px 0 0;
          color: rgba(232, 213, 163, 0.78);
          font-size: 12px;
          line-height: 1.4;
        }

        .reader-guide-stream-caret {
          display: inline-block;
          width: 2px;
          height: 1em;
          margin-left: 2px;
          background: #e7d3a1;
          vertical-align: -0.15em;
          animation: reader-guide-caret 1s steps(1) infinite;
        }

        .reader-guide-panel-error {
          margin: 0;
          padding: 8px 10px;
          border: 1px solid rgba(200, 169, 110, 0.5);
          border-left: 3px solid #e7d3a1;
          border-radius: 4px;
          background: rgba(42, 26, 14, 0.92);
          color: #f3e6c4;
          font-size: 13px;
          line-height: 1.45;
          text-align: center;
        }

        .reader-guide-panel-composer {
          display: flex;
          flex-shrink: 0;
          gap: 8px;
          padding: 10px;
          border-top: 1px solid rgba(200, 169, 110, 0.4);
          background: #1a0e08;
        }

        .reader-guide-panel-input {
          min-width: 0;
          flex: 1;
          border: 1px solid rgba(200, 169, 110, 0.45);
          border-radius: 4px;
          background: #0d0805;
          box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.45);
          padding: 8px 10px;
          color: var(--rs-text);
          font: inherit;
          font-size: 14px;
          line-height: 1.4;
        }

        .reader-guide-panel-input::placeholder {
          color: rgba(200, 169, 110, 0.55);
        }

        .reader-guide-panel-input:disabled {
          opacity: 0.72;
        }

        .reader-guide-panel-action {
          flex-shrink: 0;
          border: 1px solid var(--rs-gold);
          border-radius: 4px;
          background: linear-gradient(180deg, #4e3218 0%, #2a1a0e 100%);
          padding: 8px 12px;
          color: #f3e6c4;
          cursor: pointer;
          font: inherit;
          font-size: 14px;
          line-height: 1.2;
        }

        .reader-guide-panel-action:hover:not(:disabled) {
          filter: brightness(1.14);
        }

        .reader-guide-panel-action:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .reader-guide-cta {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-sizing: border-box;
          height: 50px;
          min-width: 200px;
          max-width: calc(100vw - 24px);
          padding: 0 18px 0 20px;
          border: 2px solid transparent;
          border-radius: 4px;
          background:
            linear-gradient(180deg, #5c3b1e 0%, #3d2410 46%, #1c1008 100%) padding-box,
            linear-gradient(180deg, #f3e0b0 0%, #c8a96e 42%, #7a5a2c 78%, #e7d3a1 100%) border-box;
          background-clip: padding-box, border-box;
          color: #f3e6c4;
          box-shadow:
            inset 0 1px 0 rgba(255, 236, 196, 0.38),
            inset 0 -12px 16px rgba(0, 0, 0, 0.38),
            0 1px 0 rgba(232, 213, 163, 0.28),
            0 10px 22px rgba(0, 0, 0, 0.55),
            0 0 18px rgba(200, 169, 110, 0.32);
          cursor: pointer;
          font-size: 15px;
          line-height: 1;
          white-space: nowrap;
          pointer-events: auto;
          transition:
            transform 180ms ease,
            filter 180ms ease,
            box-shadow 180ms ease;
        }

        .reader-guide-cta::before {
          content: "";
          position: absolute;
          inset: 1px;
          border-radius: 2px;
          background: linear-gradient(180deg, rgba(255, 236, 196, 0.18), transparent 46%);
          pointer-events: none;
        }

        .reader-guide-cta:hover {
          filter: brightness(1.1);
          transform: translateY(-2px);
          box-shadow:
            inset 0 1px 0 rgba(255, 236, 196, 0.48),
            inset 0 -12px 16px rgba(0, 0, 0, 0.38),
            0 14px 26px rgba(0, 0, 0, 0.58),
            0 0 22px rgba(200, 169, 110, 0.42);
        }

        .reader-guide-cta:focus-visible,
        .reader-guide-tooltip-close:focus-visible,
        .reader-guide-panel-close:focus-visible,
        .reader-guide-panel-input:focus-visible,
        .reader-guide-panel-action:focus-visible {
          outline: 2px solid var(--rs-gold);
          outline-offset: 2px;
        }

        .reader-guide-cta-label {
          position: relative;
          color: #f3e6c4;
        }

        .reader-guide-cta-arrow {
          position: relative;
          color: #e7d3a1;
          font-size: 20px;
          line-height: 1;
        }

        .reader-guide-rivet {
          position: absolute;
          top: 50%;
          z-index: 1;
          width: 7px;
          height: 7px;
          margin-top: -3.5px;
          border-radius: 50%;
          background: radial-gradient(circle at 32% 32%, #f3e6c4 0%, #c8a96e 42%, #6b4e2a 100%);
          box-shadow:
            inset 0 1px 1px rgba(0, 0, 0, 0.45),
            0 1px 1px rgba(0, 0, 0, 0.55);
          pointer-events: none;
        }

        .reader-guide-rivet-left {
          left: 7px;
        }

        .reader-guide-rivet-right {
          right: 7px;
        }

        .reader-guide-tooltip {
          position: absolute;
          z-index: 3;
          box-sizing: border-box;
          flex: none;
          width: 266px;
          max-width: calc(100vw - 24px);
          padding: 14px 32px 15px 16px;
          border: 1.5px solid transparent;
          border-radius: 4px;
          background:
            linear-gradient(165deg, #4e3218 0%, #2a1a0e 58%, #140c06 100%) padding-box,
            linear-gradient(180deg, #f3e0b0 0%, #c8a96e 46%, #8a6430 100%) border-box;
          background-clip: padding-box, border-box;
          box-shadow:
            inset 0 1px 0 rgba(255, 236, 196, 0.24),
            inset 0 -16px 22px rgba(0, 0, 0, 0.32),
            0 16px 32px rgba(0, 0, 0, 0.5),
            0 0 16px rgba(200, 169, 110, 0.18);
          color: var(--rs-text);
          pointer-events: auto;
        }

        .reader-guide-tooltip-heading {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 8px;
          color: #e7d3a1;
        }

        .reader-guide-tooltip-title,
        .reader-guide-tooltip-body,
        .reader-guide-tooltip-support {
          margin: 0;
        }

        .reader-guide-tooltip-title {
          flex: 1;
          min-width: 0;
          color: #f3e6c4;
          font-size: 15px;
          line-height: 1.3;
        }

        .reader-guide-tooltip-body {
          color: var(--rs-text);
          font-size: 13.5px;
          line-height: 1.55;
        }

        .reader-guide-tooltip-support {
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px solid rgba(200, 169, 110, 0.45);
          color: rgba(232, 213, 163, 0.78);
          font-size: 12.5px;
          line-height: 1.45;
        }

        .reader-guide-tooltip-close {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 24px;
          height: 24px;
          border: 0;
          border-radius: 2px;
          background: transparent;
          color: var(--rs-gold);
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          pointer-events: auto;
        }

        .reader-guide-tooltip-pointer {
          position: absolute;
          right: 22px;
          bottom: -8px;
          width: 0;
          height: 0;
          border-right: 8px solid transparent;
          border-left: 8px solid transparent;
          border-top: 8px solid #e7d3a1;
        }

        .reader-guide-tooltip-pointer::after {
          content: "";
          position: absolute;
          top: -9px;
          left: -7px;
          width: 0;
          height: 0;
          border-right: 7px solid transparent;
          border-left: 7px solid transparent;
          border-top: 7px solid #2a1a0e;
        }

        @media (max-width: 640px) {
          .reader-guide-anchor {
            bottom: calc(56px + env(safe-area-inset-bottom, 0px));
          }
        }

        @keyframes reader-guide-caret {
          50% {
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .reader-guide-cta,
          .reader-guide-tooltip-close,
          .reader-guide-panel-action {
            transition: none;
          }

          .reader-guide-cta:hover {
            transform: none;
          }

          .reader-guide-stream-caret {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
