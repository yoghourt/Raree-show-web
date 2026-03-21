import type { Location } from "@/lib/types"

interface LocationCardProps {
  location: Location
}

export default function LocationCard({ location }: LocationCardProps) {
  return (
    <article className="border border-[#c8b89a] rounded-lg p-4 bg-[#ede8dc]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-[#2c1810]">{location.name}</h3>
        <span className="text-xs px-2 py-0.5 rounded border border-[#8b1a1a]/40 text-[#8b1a1a] bg-[#8b1a1a]/10">
          {location.type}
        </span>
      </div>
      <p className="text-xs text-[#6b4c35] mt-2">{location.region || "Unknown region"}</p>
    </article>
  )
}
