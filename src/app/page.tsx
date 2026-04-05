import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getAllWorks } from "@/lib/data"

export default async function HomePage() {
  const works = await getAllWorks()

  return (
    <main className="min-h-screen bg-[#f5f0e8] text-[#2c1810]">
      <div className="max-w-4xl mx-auto px-6 py-20">

        <div className="mb-16">
          <h1 className="text-4xl font-light tracking-wide mb-3 text-[#2c1810]">
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
              className="group flex min-h-[120px] overflow-hidden border border-[#c8b89a] bg-[#ede8dc] rounded-lg hover:border-[#8b6a50] transition-colors"
            >
              <div className="relative w-[120px] shrink-0 self-stretch bg-[#c8b89a]/50">
                {work.cover_image ? (
                  <img
                    src={work.cover_image}
                    alt={`${work.title} cover`}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
              </div>

              <div className="flex flex-1 flex-col p-6 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-xl font-medium mb-2 group-hover:text-[#8b1a1a] transition-colors">
                      {work.title}
                    </h2>
                    <p className="text-[#6b4c35] text-sm leading-relaxed max-w-lg">
                      {work.description}
                    </p>
                  </div>
                  <div className="text-sm shrink-0 pt-0.5">
                    {work.books.length > 0 ? (
                      <span className="text-[#6b4c35]">
                        {work.books.length} books
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[#6b4c35] group-hover:text-[#4a3829] transition-colors">
                        <span>Explore scenes</span>
                        <ArrowRight
                          className="h-4 w-4 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-1"
                          aria-hidden
                        />
                      </span>
                    )}
                  </div>
                </div>

                {work.books.length > 0 && (
                  <div className="mt-4 flex gap-2 flex-wrap">
                    {work.books.map((book) => (
                      <span
                        key={book.id}
                        className="text-xs text-[#6b4c35] bg-[#c8b89a] rounded px-2 py-1"
                      >
                        {book.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>

      </div>
    </main>
  )
}
