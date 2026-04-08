"use client"

type CharacterStackItem = {
  id: string
  name: string
  house?: string
  image_url?: string
}

interface CharacterCardStackProps {
  characters: CharacterStackItem[]
}

export default function CharacterCardStack({ characters }: CharacterCardStackProps) {
  const visible =
    characters.length > 4
      ? characters.slice(0, 3)
      : characters.slice(0, 4)
  const extraCount = Math.max(0, characters.length - 3)

  return (
    <div className="character-stack-root">
      {visible.map((character, index) => (
        <article key={character.id} className="character-card" title={character.name}>
          <div className="char-portrait-wrap">
            {character.image_url ? (
              <img src={character.image_url} alt="" className="char-portrait" />
            ) : (
              <div className="char-portrait-fallback">{character.name.slice(0, 1).toUpperCase()}</div>
            )}
          </div>
          <div className="char-meta">
            <p className="char-name" title={character.name}>{character.name}</p>
            {character.house && character.house.trim() && character.house.trim().toLowerCase() !== "unknown house" ? (
              <p className="char-house">{character.house.trim()}</p>
            ) : null}
          </div>
        </article>
      ))}
      {characters.length > 4 && (
        <article className="character-card char-card-plus" title={`${extraCount} more characters`}>
          <div className="char-plus">+{extraCount}</div>
          <div className="char-meta">
            <p className="char-name">More</p>
            <p className="char-house">Hidden cast</p>
          </div>
        </article>
      )}

      <style jsx>{`
        .character-stack-root {
          position: fixed;
          top: 28px;
          right: 32px;
          z-index: 8;
          display: flex;
          align-items: flex-start;
          padding-right: 22px;
          pointer-events: auto;
        }

        .character-card {
          width: 90px;
          height: 130px;
          border: 1.5px solid var(--rs-wood-mid);
          background: linear-gradient(180deg, #3d2410, #2a1a0e);
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.6);
          border-radius: 4px;
          overflow: hidden;
          transform-origin: center bottom;
          transition: all 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          cursor: pointer;
        }

        .character-card:nth-child(1) {
          transform: rotate(-4deg) translateY(2px);
          margin-right: -22px;
        }
        .character-card:nth-child(2) {
          transform: rotate(2deg);
          margin-right: -22px;
          z-index: 2;
        }
        .character-card:nth-child(3) {
          transform: rotate(-1deg) translateY(3px);
          margin-right: -22px;
          z-index: 1;
        }
        .character-card:nth-child(4) {
          transform: rotate(3deg) translateY(1px);
          z-index: 0;
        }

        .character-card:hover {
          transform: rotate(0) translateY(-8px) scale(1.05);
          filter: brightness(1.18);
          z-index: 10;
          box-shadow: 0 14px 28px rgba(0, 0, 0, 0.7);
        }

        .char-portrait-wrap {
          height: 65%;
          padding: 4px;
          box-sizing: border-box;
        }

        .char-portrait,
        .char-portrait-fallback {
          width: 100%;
          height: 100%;
          border: 1px solid var(--rs-gold-dim);
          box-sizing: border-box;
        }

        .char-portrait {
          object-fit: cover;
          display: block;
        }

        .char-portrait-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--rs-gold);
          font-family: Georgia, "Times New Roman", serif;
          background: rgba(42, 26, 14, 0.8);
        }

        .char-meta {
          height: 35%;
          padding: 6px 0 4px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .char-name {
          margin: 0;
          color: var(--rs-text);
          font-size: 11px;
          line-height: 1.2;
          font-family: Georgia, "Times New Roman", serif;
          width: 100%;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .char-house {
          margin: 2px 0 0;
          color: var(--rs-text-dim);
          font-size: 9px;
          line-height: 1.1;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .char-card-plus {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
        }

        .char-plus {
          color: var(--rs-gold);
          font-size: 22px;
          line-height: 1;
          font-family: Georgia, "Times New Roman", serif;
          margin-top: 10px;
        }
      `}</style>
    </div>
  )
}

