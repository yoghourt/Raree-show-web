import Link from "next/link"
import { getWorkById, getAllCharacters, getAllLocations, getAllScenes } from "@/lib/data"
import { notFound } from "next/navigation"

interface Props {
  params: Promise<{ workId: string }>
}

export default async function WorkPage({ params }: Props) {
  const { workId } = await params
  const work = getWorkById(workId)
  if (!work) notFound()

  const scenes = getAllScenes().sort((a, b) => a.order - b.order)
  const firstScene = scenes[0]
  const characters = getAllCharacters()
  const locations = getAllLocations()

  return (
    <main className="min-h-screen bg-[#f5f0e8] text-[#2c1810]">
      <div className="max-w-4xl mx-auto px-6 py-16">

        <Link
          href="/"
          className="text-[#6b4c35] text-sm hover:text-[#2c1810] transition-colors mb-8 inline-block"
        >
          ← All works
        </Link>

        <h1 className="text-3xl font-light mb-2">{work.title}</h1>
        <p className="text-[#6b4c35] mb-12">{work.description}</p>
        {firstScene && (
          <Link
            href={`/works/${work.id}/scenes/${firstScene.id}`}
            className="inline-flex items-center border border-[#8b1a1a] bg-[#8b1a1a] rounded-md px-4 py-2 text-sm text-[#f5f0e8] hover:bg-[#6b1414] hover:border-[#6b1414] transition-colors mb-10"
          >
            Start reading →
          </Link>
        )}

        {/* Books */}
        <section className="mb-12">
          <h2 className="text-xs uppercase tracking-widest text-[#8b1a1a] mb-4">
            Books
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {work.books.map((book) => (
              <div
                key={book.id}
                className="border border-[#c8b89a] bg-[#ede8dc] rounded-lg p-4"
              >
                <div className="text-[#8b1a1a] text-xs mb-1">
                  Book {book.id}
                </div>
                <div className="text-sm font-medium leading-snug">
                  {book.title}
                </div>
                <div className="text-[#6b4c35] text-xs mt-1">
                  {book.published} · {book.chapters} chapters
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Characters */}
        <section className="mb-12">
          <h2 className="text-xs uppercase tracking-widest text-[#8b1a1a] mb-4">
            Characters · {characters.length}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {characters.slice(0, 24).map((character) => (
              <div
                key={character.id}
                className="border border-[#c8b89a] bg-[#ede8dc] rounded p-3 hover:border-[#8b6a50] transition-colors cursor-pointer"
              >
                <div className="text-sm font-medium truncate">
                  {character.name}
                </div>
                {character.house && (
                  <div className="text-xs text-[#6b4c35] truncate mt-0.5">
                    {character.house}
                  </div>
                )}
                <div className="mt-1.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    character.status === "dead"
                      ? "bg-[#8b1a1a] text-[#f5f0e8]"
                      : character.status === "alive"
                      ? "bg-[#3a5a3a] text-[#f5f0e8]"
                      : "bg-[#c8b89a] text-[#2c1810]"
                  }`}>
                    {character.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {characters.length > 24 && (
            <p className="text-[#6b4c35] text-sm mt-3">
              +{characters.length - 24} more characters
            </p>
          )}
        </section>

        {/* Locations */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-[#8b1a1a] mb-4">
            Locations · {locations.length}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {locations.slice(0, 18).map((location) => (
              <div
                key={location.id}
                className="border border-[#c8b89a] bg-[#ede8dc] rounded p-3 hover:border-[#8b6a50] transition-colors"
              >
                <div className="text-sm font-medium truncate">
                  {location.name}
                </div>
                <div className="text-xs text-[#6b4c35] mt-0.5 truncate">
                  {location.region || location.type}
                </div>
              </div>
            ))}
          </div>
          {locations.length > 18 && (
            <p className="text-[#6b4c35] text-sm mt-3">
              +{locations.length - 18} more locations
            </p>
          )}
        </section>

      </div>
    </main>
  )
}