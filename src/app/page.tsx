import { getAllWorks } from "@/lib/data"
import Bookshelf from "@/components/raree/Bookshelf"

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const works = await getAllWorks()

  return (
    <main className="min-h-screen bg-[#1a0f0a] text-[#e8dcc8]">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 2px,
              rgba(0,0,0,0.06) 2px,
              rgba(0,0,0,0.06) 4px
            ),
            repeating-linear-gradient(
              0deg,
              rgba(60,40,30,0.15),
              rgba(40,25,18,0.2) 1px,
              rgba(30,18,12,0.25) 2px
            )
          `,
        }}
        aria-hidden
      />
      <div
        className="relative mx-auto w-full max-w-5xl flex-col px-6 py-12 sm:py-16"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <header className="mb-10 text-center sm:mb-14">
          <h1 className="font-serif text-4xl font-light tracking-wide text-[#e8dcc8] drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] sm:text-5xl">
            Raree Show
          </h1>
          <p className="mt-3 text-lg text-[#c4a574]/95 sm:text-xl">
            Step inside complex worlds, one scene at a time.
          </p>
        </header>

        <div className="flex flex-col items-center pb-8">
          {works.length > 0 ? (
            <Bookshelf works={works} />
          ) : (
            <p className="text-center text-[#a08060]">No works yet.</p>
          )}
        </div>
      </div>
    </main>
  )
}
