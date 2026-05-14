"use client"

import { useEffect, useState } from "react"

type ReplaySession = {
  id: string
  createdAt: number
  source: "camera" | "upload"
  videoUrl: string
  title: string
  mission: string
  player: string
  environment?: "game" | "practice" | "mission" | "workout"
  duration?: number
}

type Props = {
  playbackId: string
  className?: string
}

function formatDuration(seconds?: number) {
  if (!seconds) return "0:00"

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  return `${mins}:${secs
    .toString()
    .padStart(2, "0")}`
}

function capitalize(value?: string) {
  if (!value) return "Unknown"

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function Meta({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.75rem] border border-zinc-900 bg-black p-4">
      <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-700">
        {label}
      </p>

      <p className="mt-3 break-words text-[clamp(1.2rem,4vw,2rem)] font-black leading-tight text-white">
        {value}
      </p>
    </div>
  )
}

export default function AxisReplayClient({
  playbackId,
  className = "",
}: Props) {
  const [session, setSession] =
    useState<ReplaySession | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem(
      `axis-session-${playbackId}`
    )

    if (!raw) return

    setSession(JSON.parse(raw))
  }, [playbackId])

  if (!session) {
    return (
      <div className="rounded-[2rem] border border-zinc-900 bg-zinc-950 p-10 text-zinc-500">
        No replay found.
      </div>
    )
  }

  return (
    <div
      className={`mx-auto w-full max-w-5xl space-y-8 px-4 pb-24 pt-10 ${className}`}
    >
      <div className="space-y-5">
        <p className="text-xs uppercase tracking-[0.45em] text-zinc-700">
          Axis Session
        </p>

        <h1 className="text-[clamp(4rem,18vw,8rem)] font-black leading-[0.88] tracking-[-0.06em] text-white">
          AXIS
          <br />
          REPLAY
        </h1>

        <p className="max-w-xl text-xl text-zinc-500 sm:text-2xl">
          Axis remembers how you play.
        </p>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-zinc-900 bg-black">
        <video
          src={session.videoUrl}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full object-cover"
        />
      </div>

      <div className="rounded-[2rem] border border-zinc-900 bg-zinc-950 p-5 sm:p-6">
        <p className="mb-8 text-xs uppercase tracking-[0.45em] text-zinc-700">
          Session Metadata
        </p>

        <div className="grid grid-cols-2 gap-4">
          <Meta
            label="Source"
            value={capitalize(session.source)}
          />

          <Meta
            label="Created"
            value={new Date(
              session.createdAt
            ).toLocaleString()}
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
            value={capitalize(
              session.environment || "practice"
            )}
          />

          <Meta
            label="Duration"
            value={formatDuration(session.duration)}
          />
        </div>
      </div>

      <div className="space-y-5">
        <div className="h-6 overflow-hidden rounded-full bg-zinc-950">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-lime-300 to-cyan-300" />
        </div>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-zinc-700">
              Behavioral Memory Upload
            </p>

            <h2 className="mt-3 text-[clamp(2.5rem,9vw,5rem)] font-black leading-[0.9] text-white">
              Behavioral
              <br />
              memory stored.
            </h2>
          </div>

          <div className="text-[clamp(4rem,18vw,8rem)] font-black leading-none tracking-[-0.06em] text-zinc-300">
            100%
          </div>
        </div>
      </div>
    </div>
  )
}