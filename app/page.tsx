"use client"

import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  async function startSession() {
    try {
      const response = await fetch("/api/session/create", {
        method: "POST",
      })

      const data = await response.json()

      if (!data.id) return

      router.push(`/session/${data.id}`)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto flex max-w-md flex-col">
        <p className="text-[11px] uppercase tracking-[0.45em] text-zinc-600">
          Axis Session
        </p>

        <h1 className="mt-6 text-[64px] font-black leading-[0.85] tracking-[-0.08em]">
          AXIS
          <br />
          REPLAY
        </h1>

        <p className="mt-8 text-2xl leading-relaxed text-zinc-400">
          Axis remembers how you play.
        </p>

        <button
          onClick={startSession}
          className="mt-14 rounded-full bg-white px-6 py-5 text-lg font-black text-black"
        >
          Start Session
        </button>
      </div>
    </main>
  )
}