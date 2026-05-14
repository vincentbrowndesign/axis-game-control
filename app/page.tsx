"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export default function HomePage() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)

  async function startSession() {
    try {
      setLoading(true)

      const response = await fetch("/api/session/create", {
        method: "POST",
      })

      const data = await response.json()

      console.log(data)

      if (!data?.id) {
        alert("Session creation failed.")
        return
      }

      router.push(`/session/${data.id}`)
    } catch (err) {
      console.error(err)
      alert("Something went wrong.")
    } finally {
      setLoading(false)
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
          disabled={loading}
          className="mt-14 rounded-full bg-white px-6 py-5 text-lg font-black text-black disabled:opacity-50"
        >
          {loading ? "Starting..." : "Start Session"}
        </button>
      </div>
    </main>
  )
}