"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type SessionData = {
  id: string
  videoUrl: string
  createdAt: number
  source: "camera" | "upload"
  title: string
  mission: string
  player: string
}

export default function SessionsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionData[]>([])

  useEffect(() => {
    const ids = JSON.parse(
      localStorage.getItem("axis-sessions") || "[]"
    ) as string[]

    const loaded = ids
      .map((id) => {
        const raw = localStorage.getItem(`axis-session-${id}`)
        return raw ? (JSON.parse(raw) as SessionData) : null
      })
      .filter(Boolean) as SessionData[]

    setSessions(loaded)
  }, [])

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="mb-3 text-xs uppercase tracking-[0.4em] text-zinc-700">
          Axis Memory
        </p>

        <h1 className="text-7xl font-black leading-none">
          SESSION
          <br />
          MEMORY
        </h1>

        <p className="mt-6 text-2xl text-zinc-500">
          Every clip becomes part of the memory layer.
        </p>

        <div className="mt-10 space-y-5">
          {sessions.length === 0 && (
            <p className="text-zinc-600">No sessions stored yet.</p>
          )}

          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => router.push(`/session/${session.id}`)}
              className="w-full rounded-[2rem] border border-zinc-900 p-5 text-left"
            >
              <video
                src={session.videoUrl}
                muted
                playsInline
                className="mb-5 aspect-video w-full rounded-[1.5rem] object-cover"
              />

              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-zinc-700">
                    {session.source}
                  </p>

                  <h2 className="mt-2 text-3xl font-black">
                    {session.player}
                  </h2>

                  <p className="mt-2 text-zinc-500">
                    {new Date(session.createdAt).toLocaleString()}
                  </p>
                </div>

                <p className="rounded-full border border-zinc-900 px-4 py-2 text-xs uppercase tracking-[0.25em] text-zinc-500">
                  Open
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}