import Link from "next/link"
import { getAllWorks } from "@/lib/data"

export default function HomePage() {
  const works = getAllWorks()

  return (
    <main className="min-h-screen bg-[#f5f0e8] text-[#2c1810]">
      <div className="max-w-4xl mx-auto px-6 py-20">

        <div className="mb-16">
          <h1 className="text-4xl font-light tracking-wide mb-3">
            Raree Show
          </h1>
          <p className="text-[#6b4c35] text-lg">
            Step inside complex worlds, one scene at a time.
          </p>
        </div>

        <div className="grid gap-4">
          {works.map((work) => (
            <Link
              key={work.id}
              href={`/works/${work.id}`}
              className="group block border border-[#c8b89a] bg-[#ede8dc] rounded-lg p-6 hover:border-[#8b1a1a]/60 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-medium mb-2 group-hover:text-[#8b1a1a] transition-colors">
                    {work.title}
                  </h2>
                  <p className="text-[#6b4c35] text-sm leading-relaxed max-w-lg">
                    {work.description}
                  </p>
                </div>
                <div className="text-[#6b4c35] text-sm ml-8 shrink-0">
                  {work.books.length} books
                </div>
              </div>

              <div className="mt-4 flex gap-2 flex-wrap">
                {work.books.map((book) => (
                  <span
                    key={book.id}
                    className="text-xs text-[#2c1810] bg-[#c8b89a] rounded px-2 py-1"
                  >
                    {book.title}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>

      </div>
    </main>
  )
}