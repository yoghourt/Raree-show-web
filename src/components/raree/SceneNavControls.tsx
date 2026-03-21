"use client"

import { useRouter } from "next/navigation"

interface SceneNavControlsProps {
  prevHref?: string
  nextHref?: string
  backToWorkHref: string
}

export default function SceneNavControls({
  prevHref,
  nextHref,
  backToWorkHref,
}: SceneNavControlsProps) {
  const router = useRouter()

  return (
    <>
      {prevHref && (
        <button
          type="button"
          onClick={() => router.push(prevHref)}
          className="absolute left-6 bottom-6 border border-[#8b1a1a] bg-[#8b1a1a] text-[#f5f0e8] px-3 py-1.5 rounded-md text-sm hover:bg-[#6b1414] hover:border-[#6b1414] transition-colors"
        >
          ← prev
        </button>
      )}

      <button
        type="button"
        onClick={() => router.push(nextHref ?? backToWorkHref)}
        className="absolute right-6 bottom-6 border border-[#8b1a1a] bg-[#8b1a1a] text-[#f5f0e8] px-4 py-2 rounded-md text-sm hover:bg-[#6b1414] hover:border-[#6b1414] transition-colors"
      >
        {nextHref ? "Next scene →" : "← Back to work"}
      </button>
    </>
  )
}
