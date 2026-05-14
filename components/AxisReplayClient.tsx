"use client"

import { useEffect, useRef, useState } from "react"

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

  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export default function AxisReplayClient({
  playbackId,
  className = "",
}: Props) {
  const [session, setSession] =
    useState<ReplaySession | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem(
      `axis-session-${playbackId}`
    )

    if (!raw) return

    const parsed = JSON.parse(raw)

    setSession(parsed)
  }, [playbackId])

  if (!session) {
    return (
      <div className="rounded-[2rem] border border-zinc-900 bg-zinc-950 p-10 text-zinc-500">
        No replay found.
      </div>
    )
  }

  return (
    <div className={`space-y-8 ${className}`}>
      <div className="space-y-5">
        <p className="text-xs uppercase tracking-[0.45em] text-zinc-700">
          Axis Session
        </p>

        <h1 className="text-7xl font-black leading-[0.9] text-white">
          AXIS
          <br />
          REPLAY
        </h1>

        <p className="text-2xl text-zinc-500">
          Axis remembers how you play.
        </p>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-zinc-900 bg-zinc-950">
        <video
          ref={videoRef}
          src={session.videoUrl}
          controls
          playsInline
          preload="metadata"
          poster="/axis-poster.jpg"
          className="w-full rounded-[2rem] bg-black object-cover"
        />
      </div>

      <div className="rounded-[2rem] border border-zinc-900 bg-zinc-950 p-6">
        <p className="mb-8 text-xs uppercase tracking-[0.45em] text-zinc-700">
          Session Metadata
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-[1.5rem] border border-zinc-900 bg-black p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.35em] text-zinc-700">
              Source
            </p>

            <h3 className="text-3xl font-black text-white">
              {session.source === "camera"
                ? "Camera"
                : "Upload"}
            </h3>
          </div>

          <div className="rounded-[1.5rem] border border-zinc-900 bg-black p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.35em] text-zinc-700">
              Created
            </p>

            <h3 className="text-3xl font-black leading-tight text-white">
              {new Date(
                session.createdAt
              ).toLocaleString()}
            </h3>
          </div>

          <div className="rounded-[1.5rem] border border-zinc-900 bg-black p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.35em] text-zinc-700">
              Mission
            </p>

            <h3 className="text-3xl font-black text-white">
              {session.mission || "None"}
            </h3>
          </div>

          <div className="rounded-[1.5rem] border border-zinc-900 bg-black p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.35em] text-zinc-700">
              Player
            </p>

            <h3 className="text-3xl font-black text-white">
              {session.player || "Unassigned"}
            </h3>
          </div>

          <div className="rounded-[1.5rem] border border-zinc-900 bg-black p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.35em] text-zinc-700">
              Environment
            </p>

            <h3 className="text-3xl font-black text-white">
              {session.environment || "Practice"}
            </h3>
          </div>

          <div className="rounded-[1.5rem] border border-zinc-900 bg-black p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.35em] text-zinc-700">
              Duration
            </p>

            <h3 className="text-3xl font-black text-white">
              {formatDuration(session.duration)}
            </h3>
          </div>
        </div>
      </div>

      <div>
        <div className="h-6 overflow-hidden rounded-full bg-zinc-950">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-lime-300 to-cyan-300" />
        </div>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-zinc-700">
              Behavioral Memory Upload
            </p>

            <h2 className="mt-3 text-5xl font-black leading-none text-white">
              Behavioral
              <br />
              memory stored.
            </h2>
          </div>

          <div className="text-8xl font-black leading-none text-zinc-300">
            100%
          </div>
        </div>
      </div>
    </div>
  )
}