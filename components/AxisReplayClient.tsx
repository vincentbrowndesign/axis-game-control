"use client"

import { useEffect, useRef, useState } from "react"
import { useSessionStore } from "@/store/useSessionStore"
import type { ReplaySessionView } from "@/types/memory"

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

type InferSignal = {
  basketballLikely: boolean
  confidence: number
  environment: string
  message: string
  timeline?: {
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

type LiveSignalLabel =
  | "ACTIVE RUNNING"
  | "COURT DETECTED"
  | "PLAYER LOCKED"
  | "LOW ACTIVITY"
  | "DEAD BALL"
  | "CROWD ENERGY"
  | "SIGNAL LOST"
  | "SIGNAL RETURNED"

type LiveSignalEvent = {
  label: LiveSignalLabel
  time: number
  detail: string
  tone: "lime" | "cyan" | "zinc"
}

type FrameSignal = {
  motionAmount: number
  cameraMovement: number
  playerVisibility: number
  courtVisibility: number
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

function normalizeSession(
  value: ReplaySessionView | null | undefined
) {
  if (!value) return null

  return {
    ...value,
    source: value.source || "upload",
    videoUrl: value.videoUrl || "",
    title: value.title || "Axis Session",
    mission: value.mission || "None",
    player: value.player || "Unassigned",
    environment: value.environment || "practice",
    duration:
      typeof value.duration === "number" &&
      Number.isFinite(value.duration)
        ? value.duration
        : 0,
    status: value.status || "stored",
    tags: Array.isArray(value.tags) ? value.tags : [],
    memoryCount:
      typeof value.memoryCount === "number" &&
      Number.isFinite(value.memoryCount)
        ? Math.max(value.memoryCount, 1)
        : 1,
    lastSignal: value.lastSignal || "MEMORY STORED",
    archiveStatus: value.archiveStatus || "ACTIVE",
    context:
      value.context ||
      "Replay linked. Session added. Memory available.",
    timeline: Array.isArray(value.timeline) ? value.timeline : [],
    ambientLine: value.ambientLine || "Context building.",
    memoryState: value.memoryState,
  }
}

function pushLiveSignal(
  events: LiveSignalEvent[],
  event: LiveSignalEvent
) {
  const previous = events[0]

  if (
    previous?.label === event.label &&
    Math.abs(previous.time - event.time) < 4
  ) {
    return events
  }

  return [event, ...events].slice(0, 8)
}

function rgbToHsl(r: number, g: number, b: number) {
  const nr = r / 255
  const ng = g / 255
  const nb = b / 255
  const max = Math.max(nr, ng, nb)
  const min = Math.min(nr, ng, nb)
  const light = (max + min) / 2

  if (max === min) {
    return {
      hue: 0,
      saturation: 0,
      light,
    }
  }

  const delta = max - min
  const saturation =
    light > 0.5
      ? delta / (2 - max - min)
      : delta / (max + min)

  let hue = 0

  if (max === nr) {
    hue = (ng - nb) / delta + (ng < nb ? 6 : 0)
  } else if (max === ng) {
    hue = (nb - nr) / delta + 2
  } else {
    hue = (nr - ng) / delta + 4
  }

  return {
    hue: hue * 60,
    saturation,
    light,
  }
}

function readFrameSignal(
  data: Uint8ClampedArray,
  previousFrame: Uint8ClampedArray | null
): FrameSignal {
  let motion = 0
  let courtPixels = 0
  let contrastPixels = 0
  let cameraShift = 0
  const pixelCount = data.length / 4

  for (let index = 0; index < data.length; index += 4) {
    const r = data[index]
    const g = data[index + 1]
    const b = data[index + 2]
    const luminance = r * 0.299 + g * 0.587 + b * 0.114
    const { hue, saturation, light } = rgbToHsl(r, g, b)
    const courtTone =
      ((hue >= 18 && hue <= 52) ||
        (hue >= 75 && hue <= 165)) &&
      saturation > 0.16 &&
      light > 0.22 &&
      light < 0.88

    if (courtTone) courtPixels += 1

    if (
      saturation > 0.2 &&
      (light < 0.28 || light > 0.72 || !courtTone)
    ) {
      contrastPixels += 1
    }

    if (previousFrame) {
      const prev =
        previousFrame[index] * 0.299 +
        previousFrame[index + 1] * 0.587 +
        previousFrame[index + 2] * 0.114
      const delta = Math.abs(luminance - prev)

      motion += delta
      if (delta > 32) cameraShift += 1
    }
  }

  return {
    motionAmount: previousFrame
      ? Math.min(1, motion / pixelCount / 42)
      : 0,
    cameraMovement: previousFrame
      ? Math.min(1, cameraShift / pixelCount / 0.38)
      : 0,
    playerVisibility: Math.min(1, contrastPixels / pixelCount / 0.28),
    courtVisibility: Math.min(1, courtPixels / pixelCount / 0.34),
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null)
  const lastActivityRef = useRef(0)
  const lastSignalLabelRef = useRef<LiveSignalLabel | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioSourceReadyRef = useRef(false)
  const audioPeakRef = useRef(0)
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
    useState<ReplaySessionView | null>(
      normalizeSession(initialSession)
    )
  const [signal, setSignal] =
    useState<InferSignal | null>(null)
  const [currentTime, setLocalCurrentTime] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [replayStatus, setReplayStatus] = useState<
    "ready" | "recovering" | "recovered" | "failed"
  >("ready")
  const [liveSignalEvents, setLiveSignalEvents] = useState<
    LiveSignalEvent[]
  >([])
  const [liveMetrics, setLiveMetrics] = useState<FrameSignal>({
    motionAmount: 0,
    cameraMovement: 0,
    playerVisibility: 0,
    courtVisibility: 0,
  })
  const [audioReady, setAudioReady] = useState(false)

  useEffect(() => {
    setPlaybackId(playbackId)

    queueMicrotask(() => {
      const localSession = safeParseSession(
        localStorage.getItem(`axis-session-${playbackId}`)
      )

      setSession(
        normalizeSession(initialSession) ||
          normalizeSession(localSession)
      )
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

      setSession(normalizeSession(data.session))
      localStorage.setItem(
        `axis-session-${playbackId}`,
        JSON.stringify(normalizeSession(data.session))
      )
      setReplayStatus("recovered")
    } catch {
      setReplayStatus("failed")
    }
  }

  async function connectAudioSignal() {
    if (audioSourceReadyRef.current || !videoRef.current) return

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext
      const context =
        audioContextRef.current || new AudioContextClass()

      if (context.state === "suspended") {
        await context.resume()
      }

      const analyser = context.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.82

      const source = context.createMediaElementSource(
        videoRef.current
      )
      source.connect(analyser)
      analyser.connect(context.destination)

      audioContextRef.current = context
      analyserRef.current = analyser
      audioSourceReadyRef.current = true
      setAudioReady(true)
    } catch (error) {
      console.warn("AXIS AUDIO SIGNAL UNAVAILABLE", error)
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

  useEffect(() => {
    let frameId = 0
    let lastSample = 0
    const audioData = new Uint8Array(128)

    function emitSignal(
      label: LiveSignalLabel,
      detail: string,
      tone: "lime" | "cyan" | "zinc"
    ) {
      const video = videoRef.current
      const time = video?.currentTime || 0

      if (
        lastSignalLabelRef.current === label &&
        Math.abs(time - lastActivityRef.current) < 3
      ) {
        return
      }

      lastSignalLabelRef.current = label
      setLiveSignalEvents((events) =>
        pushLiveSignal(events, {
          label,
          time,
          detail,
          tone,
        })
      )
    }

    function sample(now: number) {
      const video = videoRef.current
      const canvas = canvasRef.current

      if (
        video &&
        canvas &&
        !video.paused &&
        !video.ended &&
        video.readyState >= 2 &&
        now - lastSample > 420
      ) {
        lastSample = now
        const context = canvas.getContext("2d", {
          willReadFrequently: true,
        })

        if (context) {
          try {
            context.drawImage(video, 0, 0, canvas.width, canvas.height)
            const frame = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            ).data
            const signal = readFrameSignal(
              frame,
              previousFrameRef.current
            )
            previousFrameRef.current = new Uint8ClampedArray(frame)
            setLiveMetrics(signal)

            if (signal.motionAmount > 0.34) {
              lastActivityRef.current = video.currentTime
              emitSignal(
                "ACTIVE RUNNING",
                "Motion increased in replay.",
                "lime"
              )
            } else if (
              video.currentTime - lastActivityRef.current > 4 &&
              signal.motionAmount < 0.08
            ) {
              emitSignal(
                "DEAD BALL",
                "Footage is holding low movement.",
                "zinc"
              )
            } else if (signal.motionAmount < 0.12) {
              emitSignal(
                "LOW ACTIVITY",
                "Low movement detected.",
                "zinc"
              )
            }

            if (signal.courtVisibility > 0.42) {
              emitSignal(
                "COURT DETECTED",
                "Court-like surface visible.",
                "cyan"
              )
            }

            if (
              signal.playerVisibility > 0.2 &&
              signal.motionAmount > 0.16
            ) {
              emitSignal(
                "PLAYER LOCKED",
                "Moving player shape visible.",
                "lime"
              )
            }

            if (signal.cameraMovement > 0.5) {
              emitSignal(
                "SIGNAL RETURNED",
                "Camera movement re-entered frame.",
                "cyan"
              )
            }

            if (
              signal.courtVisibility < 0.08 &&
              signal.playerVisibility < 0.08 &&
              signal.motionAmount < 0.06
            ) {
              emitSignal(
                "SIGNAL LOST",
                "Replay signal is low.",
                "zinc"
              )
            }
          } catch (error) {
            console.warn("AXIS FRAME SIGNAL UNAVAILABLE", error)
            emitSignal(
              "SIGNAL LOST",
              "Frame sampling unavailable.",
              "zinc"
            )
          }
        }

        const analyser = analyserRef.current

        if (analyser) {
          analyser.getByteTimeDomainData(audioData)

          const peak = audioData.reduce((max, value) => {
            return Math.max(max, Math.abs(value - 128))
          }, 0)

          audioPeakRef.current = peak

          if (peak > 42) {
            emitSignal(
              "CROWD ENERGY",
              "Audio spike detected.",
              "cyan"
            )
          }
        }
      }

      frameId = requestAnimationFrame(sample)
    }

    frameId = requestAnimationFrame(sample)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [])

  const duration = session?.duration || 0
  const progress =
    duration > 0
      ? Math.min(100, (currentTime / duration) * 100)
      : session
        ? 100
        : 0

  const markers: Marker[] =
    Array.isArray(session?.timeline) && session.timeline.length
      ? session.timeline.map((event) => ({
          time: event.time || "00:00",
          label: event.label || "SIGNAL FOUND",
          detail: event.detail || "Session memory expanded.",
          tone: "cyan",
        }))
      : Array.isArray(signal?.timeline) && signal.timeline.length
        ? signal.timeline.map((event) => ({
            time: event.time,
            label: "SIGNAL FOUND",
            detail: "Moment added to session memory.",
            tone:
              event.type === "advantage" || event.type === "attack"
                ? "lime"
                : "cyan",
          }))
        : [
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
                signal?.message ||
                "Session context is being added to memory.",
              tone: signal?.basketballLikely ? "lime" : "zinc",
            },
            {
              time: formatClock(duration),
              label: "MEMORY STORED",
              detail: "Movement stored for this player.",
              tone: "lime",
            },
          ]

  const replayStatusLabel =
    replayStatus === "recovering"
      ? "Memory Indexing"
      : replayStatus === "recovered"
        ? "Replay Unlocked"
        : replayStatus === "failed"
          ? "Signal Interrupted"
          : session?.memoryState?.status
            ? session.memoryState.status
            : signal?.basketballLikely
              ? "Signal Active"
              : signal
                ? "Context Building"
                : "Memory Indexing"

  const contextPanelLine =
    replayStatus === "recovering"
      ? "MEMORY INDEXING"
      : replayStatus === "recovered"
        ? "REPLAY UNLOCKED"
        : replayStatus === "failed"
          ? "SIGNAL INTERRUPTED"
          : session?.memoryState?.contextLine ||
            session?.context ||
            "Replay linked. Session added. Memory available."

  const liveMarkers: Marker[] = liveSignalEvents.map((event) => ({
    time: formatClock(event.time),
    label: event.label,
    detail: event.detail,
    tone: event.tone,
  }))
  const displayMarkers = liveMarkers.length
    ? [...liveMarkers, ...markers].slice(0, 10)
    : markers
  const latestLiveSignal = liveSignalEvents[0]?.label || replayStatusLabel

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
              {session?.memoryState?.headline || "Memory Online"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_18px_rgba(190,242,100,0.8)]" />
            <p className="text-xs uppercase tracking-[0.3em] text-white/45">
              {replayStatusLabel}
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
            {displayMarkers.map((marker) => (
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
              {session.memoryState?.ambientLine ||
                session.ambientLine ||
                "Context building."}
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
              onPlay={() => {
                setPlaying(true)
                void connectAudioSignal()
              }}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onError={recoverReplay}
            />

            <div className="pointer-events-none absolute left-5 top-5 flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-lime-300" />
              <p className="text-xs uppercase tracking-[0.35em] text-white/55">
                {latestLiveSignal}
              </p>
            </div>

            <canvas
              ref={canvasRef}
              width={96}
              height={54}
              className="hidden"
            />
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
                {latestLiveSignal}
              </p>
            </div>

            <div className="border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">
                Archive Status
              </p>
              <p className="mt-3 text-2xl font-black text-lime-300">
                {session.memoryState?.archiveStatus ||
                  session.archiveStatus ||
                  "Active"}
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-3 lg:hidden">
            {displayMarkers.map((marker) => (
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
            <DetailRow
              label="Motion"
              value={`${Math.round(liveMetrics.motionAmount * 100)}%`}
            />
            <DetailRow
              label="Court"
              value={`${Math.round(liveMetrics.courtVisibility * 100)}%`}
            />
            <DetailRow
              label="Player"
              value={`${Math.round(liveMetrics.playerVisibility * 100)}%`}
            />
            <DetailRow
              label="Audio"
              value={audioReady ? "Signal Active" : "Signal Waiting"}
            />
          </div>

          <div className="mt-5 border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[10px] uppercase tracking-[0.45em] text-white/25">
              Player Context
            </p>
            <h3 className="mt-4 text-2xl font-black leading-tight text-white">
              {session.memoryCount && session.memoryCount > 1
                ? "Previous session located."
                : session.context || "Replay added to archive."}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-white/50">
              {contextPanelLine}
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
