"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSessionStore } from "@/store/useSessionStore"
import type { ReplaySessionView } from "@/types/memory"

type InferSignal = {
  basketballLikely: boolean
  confidence: number
  environment: string
  message: string
  timeline: {
    time: string
    label: string
    type: string
  }[]
  suggestions: {
    label: string
    answer: boolean | null
  }[]
}

type Props = {
  playbackId: string
  initialSession?: ReplaySessionView | null
  className?: string
}

type Marker = {
  time: string
  label: string
  detail: string
  tone: "lime" | "cyan" | "zinc"
}

function formatClock(seconds?: number) {
  if (!seconds || Number.isNaN(seconds)) return "00:00"

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`
}

function formatDuration(seconds?: number) {
  if (!seconds || Number.isNaN(seconds)) return "0:00"

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function formatMemoryCount(count?: number) {
  return Math.max(count || 1, 1)
    .toString()
    .padStart(2, "0")
}

function capitalize(value?: string) {
  if (!value) return "Unknown"

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function safeParseSession(raw: string | null) {
  if (!raw) return null

  try {
    return JSON.parse(raw) as ReplaySessionView
  } catch {
    return null
  }
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 py-3 last:border-b-0">
      <span className="text-[10px] uppercase tracking-[0.35em] text-white/30">
        {label}
      </span>
      <span className="max-w-[58%] text-right text-sm font-medium text-white/80">
        {value}
      </span>
    </div>
  )
}

function MarkerCard({ marker }: { marker: Marker }) {
  const toneClass =
    marker.tone === "lime"
      ? "text-lime-300"
      : marker.tone === "cyan"
        ? "text-cyan-300"
        : "text-white/55"

  return (
    <div className="border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p
          className={`text-[11px] uppercase tracking-[0.28em] ${toneClass}`}
        >
          {marker.label}
        </p>
        <p className="font-mono text-xs text-white/35">
          {marker.time}
        </p>
      </div>

      <p className="text-sm leading-relaxed text-white/55">
        {marker.detail}
      </p>
    </div>
  )
}

function EmptyReplay() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-5 text-white">
      <div className="w-full max-w-xl border border-white/10 bg-white/[0.03] p-8">
        <p className="text-[10px] uppercase tracking-[0.45em] text-white/30">
          Axis Replay System
        </p>
        <h1 className="mt-5 text-[clamp(3rem,14vw,6rem)] font-black leading-[0.88] tracking-[-0.06em]">
          NO
          <br />
          SIGNAL
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-white/50">
          No replay memory was found on this device for the requested session.
        </p>
      </div>
    </div>
  )
}

export default function AxisReplayClient({
  playbackId,
  initialSession = null,
  className = "",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const setPlaybackId = useSessionStore(
    (state) => state.setPlaybackId
  )
  const setCurrentTime = useSessionStore(
    (state) => state.setCurrentTime
  )
  const setPlaying = useSessionStore(
    (state) => state.setPlaying
  )

  const [session, setSession] =
    useState<ReplaySessionView | null>(initialSession)
  const [signal, setSignal] =
    useState<InferSignal | null>(null)
  const [currentTime, setLocalCurrentTime] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [replayStatus, setReplayStatus] = useState<
    "ready" | "recovering" | "recovered" | "failed"
  >("ready")

  useEffect(() => {
    setPlaybackId(playbackId)

    queueMicrotask(() => {
      const localSession = safeParseSession(
        localStorage.getItem(`axis-session-${playbackId}`)
      )

      setSession(initialSession || localSession)
      setIsLoading(false)
    })
  }, [initialSession, playbackId, setPlaybackId])

  async function recoverReplay() {
    if (replayStatus === "recovering") return

    try {
      setReplayStatus("recovering")

      const response = await fetch(`/api/replay/${playbackId}`)

      if (!response.ok) {
        setReplayStatus("failed")
        return
      }

      const data = (await response.json()) as {
        session?: ReplaySessionView
      }

      if (!data.session?.videoUrl) {
        setReplayStatus("failed")
        return
      }

      setSession(data.session)
      localStorage.setItem(
        `axis-session-${playbackId}`,
        JSON.stringify(data.session)
      )
      setReplayStatus("recovered")
    } catch {
      setReplayStatus("failed")
    }
  }

  useEffect(() => {
    let isMounted = true

    async function inferReplay() {
      try {
        const response = await fetch("/api/infer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ playbackId }),
        })

        if (!response.ok) return

        const data = (await response.json()) as InferSignal

        if (isMounted) setSignal(data)
      } catch {
        if (isMounted) setSignal(null)
      }
    }

    inferReplay()

    return () => {
      isMounted = false
    }
  }, [playbackId])

  const duration = session?.duration || 0
  const progress =
    duration > 0
      ? Math.min(100, (currentTime / duration) * 100)
      : session
        ? 100
        : 0

  const markers = useMemo<Marker[]>(() => {
    if (signal?.timeline.length) {
      return signal.timeline.map((event) => ({
        time: event.time,
        label: "SIGNAL FOUND",
        detail: "Moment added to session memory.",
        tone:
          event.type === "advantage" || event.type === "attack"
            ? "lime"
            : "cyan",
      }))
    }

    return [
      {
        time: "00:00",
        label: "FOOTAGE ACCEPTED",
        detail: "Replay linked to player archive.",
        tone: "cyan",
      },
      {
        time: formatClock(Math.max(duration * 0.33, 1)),
        label: "CONTEXT BUILDING",
        detail:
          signal?.message || "Session context is being added to memory.",
        tone: signal?.basketballLikely ? "lime" : "zinc",
      },
      {
        time: formatClock(duration),
        label: "MEMORY STORED",
        detail: "Movement stored for this player.",
        tone: "lime",
      },
    ]
  }, [duration, signal])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black px-5 py-8 text-white">
        <div className="h-2 w-full overflow-hidden bg-white/10">
          <div className="h-full w-1/3 animate-pulse bg-lime-300" />
        </div>
      </div>
    )
  }

  if (!session) return <EmptyReplay />

  return (
    <div
      className={`min-h-screen overflow-hidden bg-black text-white ${className}`}
    >
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.45em] text-white/30">
              Axis Replay System
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-white">
              Memory Online
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_18px_rgba(190,242,100,0.8)]" />
            <p className="text-xs uppercase tracking-[0.3em] text-white/45">
              {replayStatus === "recovering"
                ? "Memory Indexing"
                : replayStatus === "recovered"
                  ? "Replay Unlocked"
                : replayStatus === "failed"
                  ? "Signal Interrupted"
                  : signal
                ? signal.basketballLikely
                  ? "Signal Active"
                  : "Context Building"
                : "Memory Indexing"}
            </p>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-[292px_minmax(0,1fr)_320px]">
        <aside className="hidden border-r border-white/10 p-5 lg:block">
          <p className="mb-4 text-[10px] uppercase tracking-[0.45em] text-white/25">
            Session Thread
          </p>

          <div className="space-y-3">
            {markers.map((marker) => (
              <MarkerCard
                key={`${marker.time}-${marker.label}`}
                marker={marker}
              />
            ))}
          </div>
        </aside>

        <section className="min-w-0 px-5 py-8 lg:px-8 lg:py-10">
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.5em] text-white/30">
              Axis Memory Replay
            </p>
            <h2 className="mt-4 max-w-4xl text-[clamp(3.7rem,9vw,8rem)] font-black leading-[0.86] tracking-[-0.06em] text-white">
              AXIS
              <br />
              REPLAY
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/50">
              {session.ambientLine || "Context building."}
            </p>
          </div>

          <div className="relative overflow-hidden border border-white/10 bg-white/[0.03]">
            <video
              ref={videoRef}
              src={session.videoUrl}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full bg-black object-cover"
              onTimeUpdate={(event) => {
                const time = event.currentTarget.currentTime

                setLocalCurrentTime(time)
                setCurrentTime(time)
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onError={recoverReplay}
            />

            <div className="pointer-events-none absolute left-5 top-5 flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-lime-300" />
              <p className="text-xs uppercase tracking-[0.35em] text-white/55">
                Replay Active
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">
                Memory Count
              </p>
              <p className="mt-3 text-2xl font-black text-lime-300">
                {formatMemoryCount(session.memoryCount)}
              </p>
            </div>

            <div className="border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">
                Last Signal
              </p>
              <p className="mt-3 text-2xl font-black text-white">
                {formatClock(currentTime)}
              </p>
            </div>

            <div className="border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">
                Archive Status
              </p>
              <p className="mt-3 text-2xl font-black text-lime-300">
                Active
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-3 lg:hidden">
            {markers.map((marker) => (
              <MarkerCard
                key={`${marker.time}-${marker.label}-mobile`}
                marker={marker}
              />
            ))}
          </div>
        </section>

        <aside className="border-t border-white/10 p-5 lg:border-l lg:border-t-0">
          <p className="mb-4 text-[10px] uppercase tracking-[0.45em] text-white/25">
            Session Metadata
          </p>

          <div className="border border-white/10 bg-white/[0.03] p-5">
            <DetailRow
              label="Player"
              value={session.player || "Unassigned"}
            />
            <DetailRow
              label="Session"
              value={new Date(session.createdAt).toLocaleDateString()}
            />
            <DetailRow
              label="Environment"
              value={capitalize(session.environment || "practice")}
            />
            <DetailRow
              label="Memory Count"
              value={formatMemoryCount(session.memoryCount)}
            />
            <DetailRow
              label="Duration"
              value={formatDuration(duration)}
            />
            <DetailRow
              label="Replay Status"
              value="Replay Linked"
            />
          </div>

          <div className="mt-5 border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[10px] uppercase tracking-[0.45em] text-white/25">
              Player Context
            </p>
            <h3 className="mt-4 text-2xl font-black leading-tight text-white">
              {session.memoryCount && session.memoryCount > 1
                ? "Previous session located."
                : "Replay added to archive."}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-white/50">
              {replayStatus === "recovering"
                ? "MEMORY INDEXING"
                : replayStatus === "recovered"
                  ? "REPLAY UNLOCKED"
                : replayStatus === "failed"
                  ? "SIGNAL INTERRUPTED"
                  : "Replay linked. Session added. Memory available."}
            </p>
          </div>
        </aside>
      </div>

      <footer className="sticky bottom-0 border-t border-white/10 bg-black/85 px-5 py-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-3">
          <p className="text-[10px] uppercase tracking-[0.45em] text-white/30">
            Session Continuity
          </p>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="h-2 overflow-hidden bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-lime-300 via-cyan-300 to-white transition-all duration-300"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <div className="mt-3 flex justify-between font-mono text-xs text-white/40">
          <span>{formatClock(currentTime)}</span>
          <span>{formatClock(duration)}</span>
        </div>
      </footer>
    </div>
  )
}
