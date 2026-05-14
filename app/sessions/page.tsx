"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type SessionData = {
  id: string
  videoUrl: string
  createdAt: number
  source: "camera" | "upload"
  title: string
  mission: string
  player: string
  environment?: "game" | "practice" | "mission" | "workout"
  duration?: number
}

function formatDuration(seconds: number) {
  if (!seconds) return "0s"

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  if (mins <= 0) return `${secs}s`

  return `${mins}m ${secs}s`
}

function relativeTime(timestamp: number) {
  const diff = Date.now() - timestamp

  const mins = Math.floor(diff / 60000)

  if (mins < 1) return "Just now"

  if (mins < 60) return `${mins}m ago`

  const hours = Math.floor(mins / 60)

  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)

  return `${days}d ago`
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
        const raw = localStorage.getItem(
          `axis-session-${id}`
        )

        return raw
          ? (JSON.parse(raw) as SessionData)
          : null
      })
      .filter(Boolean) as SessionData[]

    setSessions(loaded)
  }, [])

  const ordered = useMemo(() => {
    return [...sessions].sort(
      (a, b) => b.createdAt - a.createdAt
    )
  }, [sessions])

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <p className="mb-3 text-xs uppercase tracking-[0.4em] text-zinc-700">
            Axis Replay
          </p>

          <h1 className="text-6xl font-black">
            Behavioral
            <br />
            Memory
          </h1>
        </div>

        <div className="space-y-6">
          {ordered.map((session) => (
            <button
              key={session.id}
              onClick={() =>
                router.push(`/session/${session.id}`)
              }
              className="w-full overflow-hidden rounded-[2rem] border border-zinc-900 bg-zinc-950 text-left transition hover:border-zinc-700"
            >
              <div className="relative aspect-video overflow-hidden">
                <video
                  src={session.videoUrl}
                  muted
                  className="h-full w-full object-cover opacity-70"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                <div className="absolute left-5 top-5 flex gap-2">
                  <div className="rounded-full border border-zinc-700 bg-black/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300">
                    {session.environment || "practice"}
                  </div>

                  <div className="rounded-full border border-zinc-700 bg-black/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300">
                    {session.source}
                  </div>
                </div>

                <div className="absolute bottom-5 left-5">
                  <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">
                    Behavioral Memory
                  </p>

                  <h2 className="mt-2 text-4xl font-black">
                    {session.player || "Unassigned"}
                  </h2>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                    <span>
                      {relativeTime(session.createdAt)}
                    </span>

                    <span>•</span>

                    <span>
                      {formatDuration(
                        session.duration || 0
                      )}
                    </span>

                    <span>•</span>

                    <span>
                      Mission:{" "}
                      {session.mission || "None"}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}

          {ordered.length === 0 && (
            <div className="rounded-[2rem] border border-zinc-900 p-12 text-center">
              <p className="text-2xl text-zinc-500">
                No behavioral memories stored yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}