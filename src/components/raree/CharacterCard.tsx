import type { Character } from "@/lib/types"

interface CharacterCardProps {
  character: Character
}

export default function CharacterCard({ character }: CharacterCardProps) {
  const statusClassName =
    character.status === "dead"
      ? "bg-[#c79d9d] text-[#6b1414]"
      : character.status === "alive"
      ? "bg-[#b7c7ac] text-[#294d2f]"
      : "bg-[#d9ccb6] text-[#6b4c35]"

  return (
    <article className="border border-[#c8b89a] rounded-lg p-4 bg-[#ede8dc]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-[#2c1810] truncate">{character.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded ${statusClassName}`}>
          {character.status}
        </span>
      </div>
      <p className="text-xs text-[#6b4c35] mt-1 truncate">
        {character.house || "No known house"}
      </p>
    </article>
  )
}
