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
        label: event.label,
        detail: `${capitalize(event.type)} signal captured in replay memory.`,
        tone:
          event.type === "advantage" || event.type === "attack"
            ? "lime"
            : "cyan",
      }))
    }

    return [
      {
        time: "00:00",
        label: "INGEST",
        detail: "Video attached to local behavioral memory.",
        tone: "cyan",
      },
      {
        time: formatClock(Math.max(duration * 0.33, 1)),
        label: "SIGNAL GATE",
        detail:
          signal?.message || "Inference layer waiting for court, ball, and player signal.",
        tone: signal?.basketballLikely ? "lime" : "zinc",
      },
      {
        time: formatClock(duration),
        label: "MEMORY STORED",
        detail: "Replay preserved for review and future player context.",
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
              Behavioral Memory Active
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_18px_rgba(190,242,100,0.8)]" />
            <p className="text-xs uppercase tracking-[0.3em] text-white/45">
              {signal
                ? signal.basketballLikely
                  ? "Signal Locked"
                  : "Signal Gate"
                : "Processing"}
            </p>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-[292px_minmax(0,1fr)_320px]">
        <aside className="hidden border-r border-white/10 p-5 lg:block">
          <p className="mb-4 text-[10px] uppercase tracking-[0.45em] text-white/25">
            Session Archive
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
              Axis Behavioral Replay
            </p>
            <h2 className="mt-4 max-w-4xl text-[clamp(3.7rem,9vw,8rem)] font-black leading-[0.86] tracking-[-0.06em] text-white">
              AXIS
              <br />
              REPLAY
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/50">
              Axis remembers how you play.
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
                Clock
              </p>
              <p className="mt-3 font-mono text-2xl text-white">
                {formatClock(currentTime)}
              </p>
            </div>

            <div className="border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">
                Inference
              </p>
              <p className="mt-3 text-2xl font-black text-white">
                {signal ? `${signal.confidence}%` : "PENDING"}
              </p>
            </div>

            <div className="border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">
                Stored
              </p>
              <p className="mt-3 text-2xl font-black text-lime-300">
                100%
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
              label="Mission"
              value={session.mission || "None"}
            />
            <DetailRow
              label="Source"
              value={capitalize(session.source)}
            />
            <DetailRow
              label="Environment"
              value={capitalize(session.environment || "practice")}
            />
            <DetailRow
              label="Duration"
              value={formatDuration(duration)}
            />
            <DetailRow
              label="Created"
              value={new Date(session.createdAt).toLocaleString()}
            />
          </div>

          <div className="mt-5 border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[10px] uppercase tracking-[0.45em] text-white/25">
              Inference Layer
            </p>
            <h3 className="mt-4 text-2xl font-black leading-tight text-white">
              {signal?.basketballLikely
                ? "Basketball signal detected."
                : "Waiting for court signal."}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-white/50">
              {signal?.message ||
                "Replay is available while the signal gate evaluates movement context."}
            </p>
          </div>
        </aside>
      </div>

      <footer className="sticky bottom-0 border-t border-white/10 bg-black/85 px-5 py-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-3">
          <p className="text-[10px] uppercase tracking-[0.45em] text-white/30">
            Session Timeline
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
