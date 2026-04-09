"use client"

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react"

export type StoryImageSlide = {
  url: string
  caption: string
}

export interface ImageReelProps {
  images: StoryImageSlide[]
  imageIndex: number
  onNext: () => void
  onPrev: () => void
}

export type ImageReelHandle = {
  goNext: () => void
  goPrev: () => void
}

type SlideDir = "forward" | "backward"

const ImageReel = forwardRef<ImageReelHandle, ImageReelProps>(function ImageReel(
  { images, imageIndex, onNext, onPrev },
  ref
) {
  const [sliding, setSliding] = useState(false)
  const [slideDir, setSlideDir] = useState<SlideDir>("forward")
  const skipEndRef = useRef(false)

  const n = images.length
  const nextIdx = n > 0 ? (imageIndex + 1) % n : 0
  const prevIdx = n > 0 ? (imageIndex - 1 + n) % n : 0
  const current = n > 0 ? images[imageIndex] : null

  const startForward = useCallback(() => {
    if (sliding || n <= 1 || !current) return
    skipEndRef.current = false
    setSlideDir("forward")
    setSliding(true)
  }, [current, n, sliding])

  const startBackward = useCallback(() => {
    if (sliding || n <= 1 || !current) return
    skipEndRef.current = false
    setSlideDir("backward")
    setSliding(true)
  }, [current, n, sliding])

  useImperativeHandle(
    ref,
    () => ({
      goNext: startForward,
      goPrev: startBackward,
    }),
    [startForward, startBackward]
  )

  const handleExitAnimationEnd = useCallback(() => {
    if (skipEndRef.current) return
    skipEndRef.current = true
    if (slideDir === "backward") {
      onPrev()
    } else {
      onNext()
    }
    setSliding(false)
  }, [onNext, onPrev, slideDir])

  if (n === 0 || !current) {
    return (
      <div className="image-reel-root">
        <div className="image-reel-frame-wrap">
          <div className="image-reel-card image-reel-placeholder">
            <span>No images</span>
          </div>
        </div>
        <style jsx>{`
          .image-reel-root {
            position: relative;
            overflow: visible;
            width: 520px;
            pointer-events: auto;
            z-index: 2;
          }
          .image-reel-frame-wrap {
            position: relative;
            width: 520px;
            overflow: visible;
          }
          .image-reel-card {
            display: flex;
            flex-direction: column;
            width: 520px;
            height: 82vh;
            border: 5px solid transparent;
            border-radius: 4px;
            background:
              linear-gradient(#0d0705, #0d0705) padding-box,
              linear-gradient(135deg, #3d2410 0%, #2a1a0e 50%, #3d2410 100%) border-box;
            background-clip: padding-box, border-box;
            box-shadow:
              inset 0 0 24px rgba(0, 0, 0, 0.6),
              inset 0 0 0 6px #1a0f0a,
              inset 0 0 0 9px rgba(200, 169, 110, 0.4),
              0 30px 60px rgba(0, 0, 0, 0.7),
              0 10px 20px rgba(0, 0, 0, 0.5);
            overflow: hidden;
            position: relative;
            box-sizing: border-box;
          }
          .image-reel-placeholder {
            align-items: center;
            justify-content: center;
            color: var(--rs-gold-dim);
            font-family: Georgia, "Times New Roman", serif;
            font-size: 14px;
            letter-spacing: 1px;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="image-reel-root">
      <div className="image-reel-frame-wrap">
        <span className="rivet tl" aria-hidden />
        <span className="rivet tr" aria-hidden />
        <span className="rivet bl" aria-hidden />
        <span className="rivet br" aria-hidden />
        <div className="image-reel-top-bar" aria-hidden>
          <div className="image-reel-eyepiece">
            <span className="image-reel-eyepiece-line" aria-hidden />
            <svg
              className="image-reel-lens"
              width={14}
              height={14}
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <circle
                cx={7}
                cy={7}
                r={5.25}
                stroke="#c8a96e"
                strokeWidth={1.5}
                fill="none"
              />
            </svg>
            <span className="image-reel-eyepiece-line" aria-hidden />
          </div>
        </div>

        <div className="image-reel-card">
          <div className="image-reel-img-slot">
            {!sliding && (
              <img
                src={current.url}
                alt=""
                className="image-reel-fill"
                draggable={false}
              />
            )}
            {sliding && slideDir === "forward" && (
              <>
                <img
                  key={`out-f-${imageIndex}`}
                  src={images[imageIndex].url}
                  alt=""
                  className="image-reel-fill image-reel-slide-out-up"
                  draggable={false}
                  onAnimationEnd={handleExitAnimationEnd}
                />
                <img
                  key={`in-f-${nextIdx}`}
                  src={images[nextIdx].url}
                  alt=""
                  className="image-reel-fill image-reel-slide-in-bottom"
                  draggable={false}
                />
              </>
            )}
            {sliding && slideDir === "backward" && (
              <>
                <img
                  key={`out-b-${imageIndex}`}
                  src={images[imageIndex].url}
                  alt=""
                  className="image-reel-fill image-reel-slide-out-down"
                  draggable={false}
                  onAnimationEnd={handleExitAnimationEnd}
                />
                <img
                  key={`in-b-${prevIdx}`}
                  src={images[prevIdx].url}
                  alt=""
                  className="image-reel-fill image-reel-slide-in-top"
                  draggable={false}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .image-reel-root {
          position: relative;
          overflow: visible;
          width: 520px;
          pointer-events: auto;
          z-index: 2;
        }

        .image-reel-frame-wrap {
          position: relative;
          width: 520px;
          overflow: visible;
        }

        .rivet {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: radial-gradient(
            circle at 30% 30%,
            #e5c88a 0%,
            #c8a96e 40%,
            #6b4e2a 100%
          );
          box-shadow:
            inset 0 1px 2px rgba(0, 0, 0, 0.4),
            0 1px 2px rgba(0, 0, 0, 0.6);
          z-index: 5;
          pointer-events: none;
        }

        .rivet.tl {
          top: 14px;
          left: 14px;
        }

        .rivet.tr {
          top: 14px;
          right: 14px;
        }

        .rivet.bl {
          bottom: 14px;
          left: 14px;
        }

        .rivet.br {
          bottom: 14px;
          right: 14px;
        }

        .image-reel-top-bar {
          position: absolute;
          top: -18px;
          left: 0;
          right: 0;
          height: 28px;
          width: 100%;
          max-width: 100%;
          background: linear-gradient(180deg, #3d2410 0%, #2a1a0e 100%);
          border-bottom: 1px solid rgba(200, 169, 110, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          z-index: 3;
        }

        .image-reel-eyepiece {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .image-reel-eyepiece-line {
          width: 14px;
          height: 1px;
          background: rgba(200, 169, 110, 0.4);
          flex-shrink: 0;
        }

        .image-reel-lens {
          display: block;
          flex-shrink: 0;
        }

        .image-reel-card {
          display: flex;
          flex-direction: column;
          width: 520px;
          height: 82vh;
          border: 5px solid transparent;
          border-radius: 4px;
          background:
            linear-gradient(#0d0705, #0d0705) padding-box,
            linear-gradient(135deg, #3d2410 0%, #2a1a0e 50%, #3d2410 100%) border-box;
          background-clip: padding-box, border-box;
          box-shadow:
            inset 0 0 24px rgba(0, 0, 0, 0.6),
            inset 0 0 0 6px #1a0f0a,
            inset 0 0 0 9px rgba(200, 169, 110, 0.4),
            0 30px 60px rgba(0, 0, 0, 0.7),
            0 10px 20px rgba(0, 0, 0, 0.5);
          overflow: visible;
          position: relative;
          box-sizing: border-box;
        }

        .image-reel-img-slot {
          flex: 1 1 0;
          min-height: 0;
          position: relative;
          overflow: hidden;
        }

        .image-reel-fill {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .image-reel-slide-out-up {
          z-index: 2;
          animation: imageReelSlideOutUp 600ms cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }

        .image-reel-slide-in-bottom {
          z-index: 1;
          animation: imageReelSlideInFromBottom 600ms cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }

        .image-reel-slide-out-down {
          z-index: 2;
          animation: imageReelSlideOutDown 600ms cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }

        .image-reel-slide-in-top {
          z-index: 1;
          animation: imageReelSlideInFromTop 600ms cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }

        @keyframes imageReelSlideOutUp {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(-100%);
            opacity: 0;
          }
        }

        @keyframes imageReelSlideInFromBottom {
          from {
            transform: translateY(100%);
            opacity: 1;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes imageReelSlideOutDown {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(100%);
            opacity: 0;
          }
        }

        @keyframes imageReelSlideInFromTop {
          from {
            transform: translateY(-100%);
            opacity: 1;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
})

export default ImageReel
