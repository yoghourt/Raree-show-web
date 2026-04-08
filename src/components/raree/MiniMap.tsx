"use client"

export interface MiniMapProps {
  mapUrl: string
  mapX: number
  mapY: number
  locationName?: string
}

export default function MiniMap({ mapUrl, mapX, mapY, locationName }: MiniMapProps) {
  const px = Math.min(1, Math.max(0, mapX))
  const py = Math.min(1, Math.max(0, mapY))

  return (
    <div className="mini-map-root">
      <div className="mini-map-frame">
        <img
          src={mapUrl}
          alt=""
          className="mini-map-img"
          style={{
            objectPosition: `${px * 100}% ${py * 100}%`,
          }}
          draggable={false}
        />
        <span className="mini-map-dot" style={{ left: `${px * 100}%`, top: `${py * 100}%` }} />
      </div>
      {locationName ? (
        <p className="mini-map-label" title={locationName}>
          {locationName}
        </p>
      ) : null}
      <style jsx>{`
        .mini-map-root {
          position: fixed;
          bottom: 24px;
          left: 24px;
          z-index: 25;
          width: 180px;
          pointer-events: auto;
        }

        .mini-map-frame {
          position: relative;
          width: 180px;
          height: 120px;
          border: 2px solid var(--rs-wood-mid);
          box-shadow:
            inset 0 0 0 1px var(--rs-gold-dim),
            0 4px 16px rgba(0, 0, 0, 0.6);
          border-radius: 3px;
          overflow: hidden;
        }

        .mini-map-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .mini-map-dot {
          position: absolute;
          transform: translate(-50%, -50%);
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: #8b1a1a;
          box-shadow: 0 0 0 2px rgba(139, 26, 26, 0.4);
          pointer-events: none;
        }

        .mini-map-label {
          margin: 0;
          margin-top: 6px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
          letter-spacing: 0.15em;
          color: var(--rs-text-dim);
          text-align: center;
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  )
}
