import Link from "next/link"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-md">
        <div className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
          Axis Session
        </div>

        <h1 className="mt-4 text-6xl font-black leading-none">
          AXIS
          <br />
          REPLAY
        </h1>

        <p className="mt-6 text-lg leading-relaxed text-zinc-400">
          Axis remembers how you play.
        </p>

        <Link
          href="/session/demo"
          className="mt-10 flex h-16 items-center justify-center rounded-full bg-white text-sm font-bold text-black"
        >
          Start Session
        </Link>
      </div>
    </main>
  )
}