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
  source: string
}

export default function AxisReplayClient({
  playbackId,
  className,
}: Props) {
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSession() {
      try {
        const raw = localStorage.getItem(`axis-session-${playbackId}`)

        if (!raw) {
          setLoading(false)
          return
        }

        const parsed = JSON.parse(raw)

        setSession(parsed)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    loadSession()
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

  return (
    <div className={`min-h-screen bg-black p-6 ${className || ""}`}>
      <div className="mb-10">
        <div className="mb-3 text-xs uppercase tracking-[0.4em] text-zinc-700">
          Axis Session
        </div>

        <h1 className="text-6xl font-black leading-none text-white">
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
          className="w-full"
        />
      </div>

      <div className="mt-8">
        <div className="h-6 overflow-hidden rounded-full bg-zinc-950">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-lime-300 to-cyan-300" />
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.4em] text-zinc-700">
              Behavioral Memory Upload
            </div>

            <div className="mt-4 text-3xl text-zinc-300">
              Behavioral memory stored.
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