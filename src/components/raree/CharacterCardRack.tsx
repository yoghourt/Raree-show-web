"use client"
import { motion } from "framer-motion"
import { useState } from "react"

type CharacterRackItem = {
  id: string
  name: string
  house?: string
  image_url?: string
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
          alt={character.name}
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
  return (
    <div key={sceneId} className="character-rack-root">
      {characters.map((character, index) => {
        const showHouse =
          character.house &&
          character.house.trim() &&
          character.house.trim().toLowerCase() !== "unknown house"
        const reverseIndex = totalCards - 1 - index
        return (
          <motion.article
            key={`${sceneId}-${character.id}`}
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

      <style jsx>{`
        .character-rack-root {
          position: fixed;
          right: 32px;
          bottom: 110px;
          width: auto;
          z-index: 8;
          display: flex;
          flex-direction: column-reverse;
          gap: 10px;
          align-items: flex-end;
          pointer-events: auto;
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
          transition: transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1), filter 280ms ease, box-shadow 280ms ease;
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

      `}</style>
    </div>
  )
}

