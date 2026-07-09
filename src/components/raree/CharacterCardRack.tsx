"use client"
import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { messages as locale } from "@/lib/locale"

type CharacterRackItem = {
  id: string
  name: string
  house?: string
  image_url?: string
  /** In-memory only; no extra fetch (W-02). */
  description?: string
}

interface CharacterCardRackProps {
  characters: CharacterRackItem[]
  sceneId: string
}

function CharacterPortrait({ character }: { character: CharacterRackItem }) {
  const [imgError, setImgError] = useState(false)
  const showImage = Boolean(character.image_url?.trim()) && !imgError
  const initial = (character.name?.charAt(0) ?? "?").toUpperCase()

  return (
    <div
      className="char-portrait-wrap"
      style={{ width: "100%", height: "65%", overflow: "hidden", position: "relative" }}
    >
      {showImage ? (
        <img
          src={character.image_url}
          alt=""
          className="char-portrait"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <div className="char-portrait-fallback">
          <span>{initial}</span>
        </div>
      )}
    </div>
  )
}

export default function CharacterCardRack({ characters, sceneId }: CharacterCardRackProps) {
  const totalCards = characters.length
  const [selected, setSelected] = useState<CharacterRackItem | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (selected) {
      el.showModal()
    } else if (el.open) {
      el.close()
    }
  }, [selected])

  return (
    <div key={sceneId} className="character-rack-root">
      <div className="character-rack-scroll">
        <div className="character-rack-scroll-inner">
          {characters.map((character, index) => {
            const showHouse =
              character.house &&
              character.house.trim() &&
              character.house.trim().toLowerCase() !== "unknown house"
            const reverseIndex = totalCards - 1 - index
            return (
              <motion.article
                key={`${sceneId}-${character.id}`}
                role="button"
                tabIndex={0}
                aria-label={locale.character.viewDetailsAria(character.name)}
                className="character-card"
                title={character.name}
                style={{
                  width: 88,
                  height: 124,
                  flexShrink: 0,
                  overflow: "hidden",
                  position: "relative",
                }}
                initial={{ opacity: 0, y: 140, scale: 0.82 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: reverseIndex * 0.15,
                  duration: 0.6,
                  ease: [0.34, 1.56, 0.64, 1],
                }}
                onClick={() => setSelected(character)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setSelected(character)
                  }
                }}
              >
                <CharacterPortrait character={character} />
                <div className="char-meta">
                  <span className="char-name" title={character.name}>
                    {character.name}
                  </span>
                  {showHouse ? <span className="char-house">{character.house?.trim()}</span> : null}
                </div>
              </motion.article>
            )
          })}
        </div>
      </div>

      <dialog
        ref={dialogRef}
        className="character-detail-dialog"
        onClose={() => setSelected(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            dialogRef.current?.close()
          }
        }}
      >
        {selected ? (
          <div className="character-detail-inner" onClick={(e) => e.stopPropagation()}>
            <header className="character-detail-header">
              <h2 className="character-detail-title">{selected.name}</h2>
              <button
                type="button"
                className="character-detail-close"
                aria-label={locale.character.closeAria}
                onClick={() => dialogRef.current?.close()}
              >
                ×
              </button>
            </header>
            <div className="character-detail-body">
              {selected.image_url?.trim() ? (
                <img
                  src={selected.image_url}
                  alt=""
                  className="character-detail-avatar"
                />
              ) : (
                <div className="character-detail-avatar-fallback">
                  {(selected.name?.charAt(0) ?? "?").toUpperCase()}
                </div>
              )}
              <p className="character-detail-desc">
                {selected.description?.trim() ? selected.description.trim() : locale.character.noDescription}
              </p>
            </div>
          </div>
        ) : null}
      </dialog>

      <style jsx>{`
        .character-rack-root {
          position: relative;
          display: flex;
          flex-direction: column;
          flex: 1 1 0;
          min-height: 0;
          width: fit-content;
          max-width: 100%;
          pointer-events: auto;
          --rack-card-width: 88px;
          --rack-scrollbar-gap: 18px;
        }

        .character-rack-scroll {
          display: flex;
          flex-direction: column;
          align-items: center;
          box-sizing: border-box;
          scrollbar-gutter: stable;
          padding-right: var(--rack-scrollbar-gap);
          flex: 1 1 0;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: rgba(232, 228, 220, 0.28) transparent;
        }

        .character-rack-scroll::-webkit-scrollbar {
          width: 8px;
        }

        .character-rack-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .character-rack-scroll::-webkit-scrollbar-thumb {
          background-color: rgba(232, 228, 220, 0.22);
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }

        .character-rack-scroll::-webkit-scrollbar-thumb:hover {
          background-color: rgba(232, 228, 220, 0.22);
        }

        .character-rack-scroll::-webkit-scrollbar-thumb:active {
          background-color: rgba(232, 228, 220, 0.3);
        }

        .character-rack-scroll-inner {
          margin-top: auto;
          flex-shrink: 0;
          width: var(--rack-card-width);
          display: flex;
          flex-direction: column-reverse;
          gap: 10px;
          align-items: stretch;
          box-sizing: border-box;
        }

        .character-card {
          width: 88px;
          height: 124px;
          flex-shrink: 0;
          border: 1.5px solid var(--rs-wood-mid);
          background: linear-gradient(180deg, #3d2410, #2a1a0e);
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.6);
          border-radius: 4px;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition:
            transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1),
            filter 280ms ease,
            box-shadow 280ms ease;
        }

        .character-card:focus {
          outline: 2px solid var(--rs-gold);
          outline-offset: 2px;
        }

        .character-card:hover {
          transform: translateX(-12px) scale(1.05);
          filter: brightness(1.18);
          z-index: 20;
          box-shadow: 0 14px 28px rgba(0, 0, 0, 0.7);
        }

        .char-portrait-wrap {
          height: 65%;
          width: 100%;
          padding: 4px;
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
        }

        .char-portrait,
        .char-portrait-fallback {
          width: 100%;
          height: 100%;
          border: 1px solid var(--rs-gold-dim);
          box-sizing: border-box;
          max-width: 100%;
          max-height: 100%;
        }

        .char-portrait {
          object-fit: cover;
          display: block;
        }

        .char-portrait-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #3d2410 0%, #2a1a0e 100%);
          position: relative;
        }

        .char-portrait-fallback::before {
          content: "";
          position: absolute;
          inset: 8px;
          border: 1px solid var(--rs-gold-dim);
          border-radius: 2px;
          pointer-events: none;
        }

        .char-portrait-fallback span {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 38px;
          font-weight: 600;
          color: var(--rs-gold);
          text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
        }

        .char-meta {
          height: 35%;
          padding: 6px 0 4px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: center;
          text-align: center;
        }

        .char-name {
          color: var(--rs-text);
          font-size: 11px;
          line-height: 1.2;
          font-family: Georgia, "Times New Roman", serif;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .char-house {
          margin-top: 2px;
          color: var(--rs-text-dim);
          font-size: 9px;
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .character-detail-dialog {
          margin: auto;
          max-width: min(420px, calc(100vw - 48px));
          width: 100%;
          border: 1.5px solid var(--rs-wood-mid);
          border-radius: 8px;
          padding: 0;
          background: linear-gradient(180deg, #2a1a0e, #1a100a);
          color: var(--rs-text);
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.75);
        }

        .character-detail-dialog::backdrop {
          background: rgba(0, 0, 0, 0.55);
        }

        .character-detail-inner {
          padding: 16px 18px 20px;
        }

        .character-detail-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .character-detail-title {
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 1.15rem;
          font-weight: 600;
          color: var(--rs-gold);
          line-height: 1.25;
        }

        .character-detail-close {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border: 1px solid var(--rs-gold-dim);
          border-radius: 4px;
          background: rgba(61, 36, 16, 0.6);
          color: var(--rs-text);
          font-size: 1.25rem;
          line-height: 1;
          cursor: pointer;
        }

        .character-detail-close:hover {
          filter: brightness(1.15);
        }

        .character-detail-body {
          display: flex;
          flex-direction: column;
          gap: 14px;
          align-items: center;
        }

        .character-detail-avatar {
          width: 120px;
          height: 120px;
          object-fit: cover;
          border-radius: 4px;
          border: 2px solid var(--rs-gold-dim);
        }

        .character-detail-avatar-fallback {
          width: 120px;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          border: 2px solid var(--rs-gold-dim);
          background: linear-gradient(135deg, #3d2410 0%, #2a1a0e 100%);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 2.5rem;
          font-weight: 600;
          color: var(--rs-gold);
        }

        .character-detail-desc {
          margin: 0;
          width: 100%;
          font-size: 13px;
          line-height: 1.55;
          color: var(--rs-text);
          white-space: pre-wrap;
        }
      `}</style>
    </div>
  )
}
