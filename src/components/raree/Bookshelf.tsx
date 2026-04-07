"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import type { Work } from "@/lib/types"

interface BookshelfProps {
  works: Work[]
}

export default function Bookshelf({ works }: BookshelfProps) {
  const router = useRouter()
  const [openWork, setOpenWork] = useState<Work | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const close = useCallback(() => setOpenWork(null), [])

  useEffect(() => {
    if (!openWork) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [openWork, close])

  return (
    <>
      <div className="flex w-full max-w-5xl flex-col items-center">
        <div
          className="relative flex w-full flex-row flex-wrap items-end justify-center px-2 pb-0 sm:px-4"
          style={{ gap: "2px" }}
        >
          {works.map((work) => {
            const isHovered = hoveredId === work.id
            return (
              <div
                key={work.id}
                className="flex shrink-0 flex-col items-center"
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${work.title}`}
                  onClick={() => setOpenWork(work)}
                  onMouseEnter={() => setHoveredId(work.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setOpenWork(work)
                    }
                  }}
                  className={`focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c4a574] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a0f0a] ${isHovered ? "z-10" : ""}`}
                  style={{
                    perspective: "800px",
                    perspectiveOrigin: "50% 50%",
                    width: "50px",
                    height: "180px",
                    flexShrink: 0,
                    cursor: "pointer",
                    overflow: "visible",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: "120px",
                      height: "100%",
                      transformStyle: "preserve-3d",
                      transform: isHovered
                        ? "rotateY(0deg)"
                        : "rotateY(70deg)",
                      transition: "transform 0.5s ease",
                      transformOrigin: "left center",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "120px",
                        height: "100%",
                        backfaceVisibility: "hidden",
                        overflow: "hidden",
                        borderRadius: "2px 4px 4px 2px",
                        boxShadow: "4px 0 15px rgba(0,0,0,0.5)",
                      }}
                    >
                      {work.cover_image ? (
                        <img
                          src={work.cover_image}
                          alt=""
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            background:
                              "linear-gradient(145deg, #4a3228 0%, #2a1810 50%, #1a0f0a 100%)",
                          }}
                        />
                      )}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "36px",
                        height: "100%",
                        background:
                          "linear-gradient(to right, #1a0f0a, #3d2412, #2a1608)",
                        transform: "rotateY(-90deg) translateX(-18px)",
                        transformOrigin: "left center",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "2px 0 0 2px",
                        boxShadow: "inset -3px 0 8px rgba(0,0,0,0.4)",
                      }}
                    >
                      <span
                        style={{
                          writingMode: "vertical-rl",
                          textOrientation: "mixed",
                          color: "#e8d5b0",
                          fontSize: "11px",
                          letterSpacing: "0.1em",
                          padding: "12px 0",
                          textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                        }}
                      >
                        {work.title}
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  aria-hidden
                  style={{
                    width: "50px",
                    height: "6px",
                    background:
                      "radial-gradient(ellipse, rgba(0,0,0,0.5), transparent)",
                  }}
                />
              </div>
            )
          })}
        </div>
        <div
          className="relative -mt-px h-4 w-full max-w-5xl rounded-b-sm bg-gradient-to-b from-[#4a3228] to-[#2d1e16] shadow-[0_10px_24px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]"
          aria-hidden
        />
      </div>

      {openWork ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bookshelf-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            minHeight: "100vh",
            background: "rgba(15, 8, 4, 0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={close}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
              overflow: "visible",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close dialog"
              onClick={close}
              style={{
                position: "absolute",
                top: "0px",
                right: "-48px",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(255,255,255,0.5)",
                transition: "color 0.2s",
                padding: "4px",
                zIndex: 2,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.9)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.5)"
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div
              style={{
                display: "flex",
                width: "700px",
                height: "460px",
                filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.8))",
                animation: "bookOpen 0.5s ease forwards",
                position: "relative",
                borderRadius: "2px 4px 4px 2px",
                boxShadow: `
                  0 6px 0 #e8dfc8,
                  0 10px 0 #ddd4b8,
                  0 14px 0 #d0c5a0,
                  6px 6px 0 #e8dfc8,
                  10px 10px 0 #ddd4b8,
                  14px 14px 0 #d0c5a0,
                  16px 20px 30px rgba(0,0,0,0.7)
                `,
              }}
            >
              <div
                style={{
                  width: "50%",
                  height: "100%",
                  borderRadius: "4px 0 0 4px",
                  overflow: "hidden",
                  position: "relative",
                  boxShadow: "inset -8px 0 20px rgba(0,0,0,0.4)",
                }}
              >
                {openWork.cover_image ? (
                  <img
                    src={openWork.cover_image}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "center top",
                    }}
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-[#4a3228] to-[#1a0f0a]" />
                )}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: "40px",
                    height: "100%",
                    background:
                      "linear-gradient(to left, rgba(0,0,0,0.25), transparent)",
                    pointerEvents: "none",
                  }}
                />
              </div>

              <div
                aria-hidden
                style={{
                  width: "8px",
                  height: "100%",
                  flexShrink: 0,
                  background:
                    "linear-gradient(to right, #1a0f0a 0%, #2a1608 50%, #1a0f0a 100%)",
                  boxShadow: "none",
                  zIndex: 1,
                }}
              />

              <div
                style={{
                  width: "50%",
                  height: "100%",
                  background:
                    "linear-gradient(135deg, #f5f0e8 0%, #ede8dc 50%, #e8e0d0 100%)",
                  borderRadius: "0 4px 4px 0",
                  padding: "40px 40px 36px 40px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  boxShadow: "inset 8px 0 20px rgba(0,0,0,0.15)",
                  borderLeft: "none",
                  boxSizing: "border-box",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "40px",
                    height: "100%",
                    background: "linear-gradient(to right, rgba(0,0,0,0.18), transparent)",
                    pointerEvents: "none",
                    zIndex: 1,
                    borderRadius: "0",
                  }}
                />
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "inherit",
                    pointerEvents: "none",
                    background:
                      "repeating-linear-gradient(to bottom, transparent, transparent 27px, rgba(180,160,130,0.15) 27px, rgba(180,160,130,0.15) 28px)",
                  }}
                />

                <div style={{ position: "relative", zIndex: 1 }}>
                  <h2
                    id="bookshelf-modal-title"
                    style={{
                      fontSize: "26px",
                      color: "#2c1810",
                      fontFamily: "serif",
                      marginBottom: "16px",
                      lineHeight: 1.3,
                    }}
                  >
                    {openWork.title}
                  </h2>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#6b4c35",
                      lineHeight: 1.8,
                      marginBottom: "8px",
                    }}
                  >
                    {openWork.description}
                  </p>
                </div>

                <div
                  style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "flex-end",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/works/${openWork.id}`)}
                    style={{
                      display: "inline-block",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#2c1810",
                      padding: "0",
                      transition: "opacity 0.2s",
                      animation: "bobbing 2s ease-in-out infinite",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.6")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="30" cy="30" r="22" stroke="#8b6914" strokeWidth="4" fill="rgba(240,230,200,0.15)"/>
                      <circle cx="30" cy="30" r="18.5" stroke="#a07820" strokeWidth="1.2" fill="none" opacity="0.7"/>
                      <circle cx="30" cy="30" r="18" fill="rgba(180,210,220,0.12)"/>
                      <path d="M 18 22 Q 20 15 28 14" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                      <circle cx="30" cy="8.5" r="2" fill="#8b6914"/>
                      <circle cx="30" cy="51.5" r="2" fill="#8b6914"/>
                      <circle cx="8.5" cy="30" r="2" fill="#8b6914"/>
                      <circle cx="51.5" cy="30" r="2" fill="#8b6914"/>
                      <path d="M 47 47 L 72 72" stroke="#5c3210" strokeWidth="7" strokeLinecap="round"/>
                      <path d="M 47 47 L 72 72" stroke="#8b5a1a" strokeWidth="4" strokeLinecap="round" opacity="0.6"/>
                      <path d="M 48 48 L 70 70" stroke="rgba(200,150,80,0.25)" strokeWidth="1.5" strokeLinecap="round"/>
                      <circle cx="46" cy="46" r="4" stroke="#8b6914" strokeWidth="2" fill="#c8a84a"/>
                      <circle cx="46" cy="46" r="2" fill="#8b6914"/>
                      <line x1="30" y1="16" x2="30" y2="20" stroke="#8b6914" strokeWidth="1" opacity="0.6"/>
                      <line x1="30" y1="40" x2="30" y2="44" stroke="#8b6914" strokeWidth="1" opacity="0.6"/>
                      <line x1="16" y1="30" x2="20" y2="30" stroke="#8b6914" strokeWidth="1" opacity="0.6"/>
                      <line x1="40" y1="30" x2="44" y2="30" stroke="#8b6914" strokeWidth="1" opacity="0.6"/>
                    </svg>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      ) : null}
      <style>{`
        @keyframes bookOpen {
          from { transform: scale(0.85); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes bobbing {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </>
  )
}
