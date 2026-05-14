"use client"

import { useEffect, useState } from "react"

type Props = {
  playbackId: string
  className?: string
}

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

export default function AxisReplayClient({
  playbackId,
  className,
}: Props) {
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(
        `axis-session-${playbackId}`
      )

      if (raw) {
        const parsed = JSON.parse(raw) as SessionData
        setSession(parsed)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [playbackId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">
        Loading replay...
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">
        Session not found.
      </div>
    )
  }

  const created = new Date(
    session.createdAt
  ).toLocaleString()

  return (
    <div
      className={`min-h-screen bg-black p-6 text-white ${
        className || ""
      }`}
    >
      <div className="mb-10">
        <div className="mb-3 text-xs uppercase tracking-[0.4em] text-zinc-700">
          Axis Session
        </div>

        <h1 className="text-7xl font-black leading-none">
          AXIS
          <br />
          REPLAY
        </h1>

        <p className="mt-6 text-2xl text-zinc-500">
          Axis remembers how you play.
        </p>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-zinc-900 bg-black">
        <video
          src={session.videoUrl}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black object-cover"
        />
      </div>

      <section className="mt-8 rounded-[2rem] border border-zinc-900 p-6">
        <p className="text-xs uppercase tracking-[0.4em] text-zinc-700">
          Session Metadata
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <Meta
            label="Source"
            value={capitalize(session.source)}
          />

          <Meta
            label="Created"
            value={created}
          />

          <Meta
            label="Mission"
            value={session.mission || "None"}
          />

          <Meta
            label="Player"
            value={session.player || "Unassigned"}
          />

          <Meta
            label="Environment"
            value={
              capitalize(
                session.environment || "practice"
              )
            }
          />

          <Meta
            label="Duration"
            value={formatDuration(session.duration || 0)}
          />
        </div>
      </section>

      <div className="mt-8">
        <div className="h-6 overflow-hidden rounded-full bg-zinc-950">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-lime-300 to-cyan-300" />
        </div>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.4em] text-zinc-700">
              Behavioral Memory Upload
            </div>

            <div className="mt-4 text-3xl leading-tight text-zinc-300">
              Behavioral
              <br />
              memory stored.
            </div>
          </div>

          <div className="text-7xl font-black text-zinc-300">
            100%
          </div>
        </div>
      </div>
    </div>
  )
}

function Meta({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-zinc-900 p-4">
      <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-700">
        {label}
      </p>

      <p className="mt-3 break-words text-2xl font-black leading-tight text-white">
        {value}
      </p>
    </div>
  )
}

function formatDuration(seconds: number) {
  if (!seconds) return "0:00"

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  return `${mins}:${secs
    .toString()
    .padStart(2, "0")}`
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}