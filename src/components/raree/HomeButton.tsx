"use client"

import Link from "next/link"

export default function HomeButton() {
  return (
    <Link href="/" className="home-btn" aria-label="Back to home">
      <span className="home-btn-arrow" aria-hidden>
        ←
      </span>
      <span className="home-btn-text">HOME</span>
      <span className="rivet tl" aria-hidden />
      <span className="rivet tr" aria-hidden />

      <style jsx>{`
        .home-btn {
          position: fixed;
          left: 32px;
          bottom: 200px;
          width: 112px;
          height: 40px;
          border: 2px solid var(--rs-wood-mid);
          background: linear-gradient(135deg, #3d2410, #2a1a0e);
          border-radius: 4px;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 250ms ease;
          text-decoration: none;
          z-index: 8;
          box-sizing: border-box;
        }

        .home-btn:hover {
          filter: brightness(1.18);
          transform: translateY(-2px);
          box-shadow: 0 12px 22px rgba(0, 0, 0, 0.65);
        }

        .home-btn-arrow {
          font-size: 14px;
          color: var(--rs-gold);
          line-height: 1;
        }

        .home-btn-text {
          color: var(--rs-text);
          font-size: 11px;
          letter-spacing: 2px;
          font-family: Georgia, "Times New Roman", serif;
          text-transform: uppercase;
          line-height: 1;
        }

        .rivet {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #e5c88a 0%, #c8a96e 40%, #6b4e2a 100%);
          box-shadow:
            inset 0 1px 2px rgba(0, 0, 0, 0.4),
            0 1px 2px rgba(0, 0, 0, 0.6);
          pointer-events: none;
        }

        .rivet.tl {
          top: 4px;
          left: 6px;
        }

        .rivet.tr {
          top: 4px;
          right: 6px;
        }
      `}</style>
    </Link>
  )
}

