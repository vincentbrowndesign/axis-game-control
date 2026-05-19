"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import MuxPlayer from "@mux/mux-player-react"

type LiveStatus =
  | "CONNECTING"
  | "LIVE"
  | "RECONNECTING"
  | "CAMERA BLOCKED"
  | "MUX PLAYBACK ID MISSING"

type MomentAnchor = {
  id: string
  elapsed: number
  label: string
}

const anchorStorageKey = "axis-live-thread-anchors"
const clockStorageKey = "axis-live-thread-started-at"

const recorderTypes = [
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9,opus",
  "video/webm",
  "video/mp4;codecs=h264,mp4a.40.2",
  "video/mp4",
]

function getRecorderType() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return ""
  }

  return recorderTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
}

function formatClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export function LiveMemoryStream() {
  const fallbackPlaybackId = process.env.NEXT_PUBLIC_MUX_PLAYBACK_ID || ""
  const [playbackId, setPlaybackId] = useState(fallbackPlaybackId)
  const [status, setStatus] = useState<LiveStatus>("CONNECTING")
  const [muxPlaying, setMuxPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [anchors, setAnchors] = useState<MomentAnchor[]>([])
  const [lastPinnedId, setLastPinnedId] = useState("")
  const [threadHydrated, setThreadHydrated] = useState(false)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const sessionIdRef = useRef("")
  const chunkQueueRef = useRef<Promise<void>>(Promise.resolve())
  const startedRef = useRef(false)
  const elapsedRef = useRef(0)
  const clockStartedAtRef = useRef(0)

  const flowState = useMemo(() => {
    if (status === "CONNECTING") return "SETTLING"
    if (status === "RECONNECTING") return "DRIFT"
    if (status !== "LIVE") return "STILL"
    if (anchors.some((anchor) => elapsed - anchor.elapsed <= 12)) return "PINNED"
    return "RUNNING"
  }, [anchors, elapsed, status])

  const railEnd = useMemo(() => Math.max(60, elapsed), [elapsed])

  useEffect(() => {
    const now = Date.now()
    const storedClock = window.sessionStorage.getItem(clockStorageKey)
    const storedClockValue = storedClock ? Number(storedClock) : 0
    const safeClock =
      storedClockValue > 0 && storedClockValue <= now ? storedClockValue : now

    clockStartedAtRef.current = safeClock
    window.sessionStorage.setItem(clockStorageKey, String(safeClock))

    let storedThreadAnchors: MomentAnchor[] = []

    try {
      const storedAnchors = window.localStorage.getItem(anchorStorageKey)
      const parsedAnchors = storedAnchors
        ? (JSON.parse(storedAnchors) as MomentAnchor[])
        : []
      const nextElapsed = (now - safeClock) / 1000

      if (Array.isArray(parsedAnchors)) {
        storedThreadAnchors = parsedAnchors
          .filter(
            (anchor) =>
              typeof anchor.id === "string" &&
              typeof anchor.elapsed === "number" &&
              anchor.elapsed >= 0 &&
              anchor.elapsed <= nextElapsed + 10 &&
              typeof anchor.label === "string"
          )
          .slice(-12)
      }
    } catch {
      window.localStorage.removeItem(anchorStorageKey)
    }

    const hydrationTimer = window.setTimeout(() => {
      setAnchors(storedThreadAnchors)
      setThreadHydrated(true)
    }, 0)

    const timer = window.setInterval(() => {
      const nextElapsed = (Date.now() - clockStartedAtRef.current) / 1000
      elapsedRef.current = nextElapsed
      setElapsed(nextElapsed)
    }, 1000)

    return () => {
      window.clearTimeout(hydrationTimer)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!threadHydrated) return

    window.localStorage.setItem(anchorStorageKey, JSON.stringify(anchors.slice(-12)))
  }, [anchors, threadHydrated])

  useEffect(() => {
    if (!lastPinnedId) return

    const timeout = window.setTimeout(() => setLastPinnedId(""), 1600)

    return () => window.clearTimeout(timeout)
  }, [lastPinnedId])

  const pinMoment = () => {
    const nextAnchor: MomentAnchor = {
      id: `anchor-${Date.now().toString(36)}`,
      elapsed: elapsedRef.current,
      label: flowState,
    }

    setAnchors((current) => [...current.slice(-10), nextAnchor])
    setLastPinnedId(nextAnchor.id)
  }

  const replayAnchor = (anchor: MomentAnchor) => {
    const player = surfaceRef.current?.querySelector("mux-player") as
      | (HTMLElement & {
          currentTime?: number
          play?: () => Promise<void> | void
        })
      | null

    if (!player || typeof player.currentTime !== "number") return

    const secondsBack = Math.max(0, elapsedRef.current - anchor.elapsed)
    player.currentTime = Math.max(0, player.currentTime - secondsBack)
    setLastPinnedId(anchor.id)
    const playResult = player.play?.()

    if (playResult instanceof Promise) {
      playResult.catch(() => undefined)
    }
  }

  const railAnchors = useMemo(() => {
    return anchors.map((anchor) => ({
      ...anchor,
      position: Math.min(98, Math.max(2, (anchor.elapsed / railEnd) * 100)),
    }))
  }, [anchors, railEnd])

  const liveDotClass = useMemo(() => {
    if (status === "LIVE") return "bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.85)]"
    if (status === "RECONNECTING") return "bg-amber-200/80 shadow-[0_0_22px_rgba(252,211,77,0.42)]"
    return "bg-zinc-200/70 shadow-[0_0_16px_rgba(244,244,245,0.28)]"
  }, [status])

  useEffect(() => {
    if (
      startedRef.current ||
      typeof window === "undefined" ||
      typeof navigator === "undefined"
    ) {
      return
    }

    let cancelled = false
    let localStream: MediaStream | null = null

    async function postChunk(chunk: Blob) {
      const sessionId = sessionIdRef.current

      if (cancelled || !sessionId || !chunk.size) return

      const response = await fetch("/api/live/chunk", {
        method: "POST",
        headers: {
          "content-type": chunk.type || "application/octet-stream",
          "x-axis-live-session": sessionId,
        },
        body: chunk,
      })

      if (cancelled) return

      if (!response.ok) {
        setStatus("RECONNECTING")
        return
      }

      setStatus("LIVE")
    }

    async function startLiveCamera() {
      startedRef.current = true
      setStatus("CONNECTING")

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("CAMERA BLOCKED")
        return
      }

      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: {
            ideal: "environment",
          },
          width: {
            ideal: 1280,
          },
          height: {
            ideal: 720,
          },
        },
      })

      if (cancelled) {
        localStream.getTracks().forEach((track) => track.stop())
        return
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream
        await localVideoRef.current.play().catch(() => undefined)
      }

      const startResponse = await fetch("/api/live/start", {
        method: "POST",
      })

      if (!startResponse.ok) {
        if (!fallbackPlaybackId) setStatus("MUX PLAYBACK ID MISSING")
        else setStatus("RECONNECTING")
        return
      }

      const startData = (await startResponse.json()) as {
        sessionId?: string
        playbackId?: string
      }

      if (!startData.sessionId) {
        setStatus("RECONNECTING")
        return
      }

      sessionIdRef.current = startData.sessionId
      setPlaybackId(startData.playbackId || fallbackPlaybackId)

      const recorderType = getRecorderType()

      if (typeof MediaRecorder === "undefined") {
        setStatus("RECONNECTING")
        return
      }

      const recorder = new MediaRecorder(
        localStream,
        recorderType
          ? {
              mimeType: recorderType,
              videoBitsPerSecond: 2400000,
              audioBitsPerSecond: 128000,
            }
          : {
              videoBitsPerSecond: 2400000,
              audioBitsPerSecond: 128000,
            }
      )

      recorder.ondataavailable = (event) => {
        if (!event.data.size) return

        chunkQueueRef.current = chunkQueueRef.current
          .then(() => postChunk(event.data))
          .catch(() => {
            setStatus("RECONNECTING")
          })
      }
      recorder.onerror = () => setStatus("RECONNECTING")
      recorder.onstart = () => setStatus("LIVE")
      recorderRef.current = recorder
      recorder.start(1200)
    }

    startLiveCamera().catch(() => {
      setStatus(localStream ? "RECONNECTING" : "CAMERA BLOCKED")
    })

    return () => {
      cancelled = true

      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop()
      }

      localStream?.getTracks().forEach((track) => track.stop())

      const sessionId = sessionIdRef.current
      if (sessionId) {
        fetch("/api/live/stop", {
          method: "POST",
          headers: {
            "x-axis-live-session": sessionId,
          },
          keepalive: true,
        }).catch(() => undefined)
      }

      sessionIdRef.current = ""
    }
  }, [fallbackPlaybackId])

  return (
    <main className="h-dvh overflow-hidden bg-black text-zinc-100">
      <section ref={surfaceRef} className="relative h-dvh overflow-hidden bg-black">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            muxPlaying ? "opacity-0" : "opacity-100"
          }`}
        />

        {playbackId ? (
          <MuxPlayer
            playbackId={playbackId}
            streamType="live"
            autoPlay
            muted
            playsInline
            preferPlayback="mse"
            onPlaying={() => setMuxPlaying(true)}
            onError={() => setMuxPlaying(false)}
            className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${
              muxPlaying ? "opacity-100" : "opacity-0"
            }`}
            style={{
              ["--media-object-fit" as string]: "cover",
            }}
          />
        ) : null}

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.64),transparent_24%,transparent_68%,rgba(0,0,0,0.82))]" />
        <div
          className={`absolute inset-0 transition-opacity duration-1000 ${
            status === "RECONNECTING"
              ? "bg-[radial-gradient(circle_at_50%_55%,rgba(251,191,36,0.08),transparent_38%)] opacity-100"
              : "opacity-0"
          }`}
        />

        {!playbackId && status === "MUX PLAYBACK ID MISSING" ? (
          <div className="absolute inset-0 z-10 grid place-items-center px-6 text-center">
            <div>
              <p className="text-3xl font-black uppercase tracking-[-0.04em] text-zinc-100 sm:text-5xl">
                MUX PLAYBACK ID MISSING
              </p>
              <p className="mt-3 text-sm font-bold leading-6 text-zinc-500">
                Set NEXT_PUBLIC_MUX_PLAYBACK_ID or configure Mux live ingest.
              </p>
            </div>
          </div>
        ) : null}

        <header className="absolute left-4 right-4 top-4 z-20 rounded-[1.15rem] border border-white/10 bg-black/42 px-4 py-3 backdrop-blur-md">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="min-w-0">
              <p className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                Home
              </p>
              <p className="mt-1 text-3xl font-black leading-none tracking-[-0.06em] text-zinc-100">
                0
              </p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <span className={`h-2 w-2 rounded-full ${liveDotClass}`} />
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200">
                  Live
                </span>
              </div>
              <p className="mt-2 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">
                1 / {formatClock(elapsed)}
              </p>
              <p className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-200">
                {flowState}
              </p>
            </div>

            <div className="min-w-0 text-right">
              <p className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                Away
              </p>
              <p className="mt-1 text-3xl font-black leading-none tracking-[-0.06em] text-zinc-100">
                0
              </p>
            </div>
          </div>
        </header>

        <footer className="absolute bottom-5 left-4 right-4 z-20">
          <div className="mx-auto max-w-4xl">
            <div className="mb-4 flex justify-center">
              <button
                type="button"
                onClick={pinMoment}
                className="rounded-full border border-white/10 bg-zinc-100/90 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition active:scale-95"
              >
                Save Moment
              </button>
            </div>

            <div
              className={`relative h-12 overflow-hidden rounded-full border border-white/10 bg-black/48 px-4 backdrop-blur-md transition-opacity duration-700 ${
                status === "LIVE" ? "opacity-100" : "opacity-75"
              }`}
            >
              <div className="absolute left-5 right-5 top-1/2 h-px -translate-y-1/2 bg-white/16" />
              <div className="absolute left-5 right-5 top-1/2 h-5 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-white/12 to-transparent opacity-70 blur-md motion-safe:animate-pulse" />
              <div
                className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-emerald-200 shadow-[0_0_18px_rgba(167,243,208,0.72)] transition-all duration-500"
                style={{
                  left: `${Math.min(96, Math.max(4, (elapsed / railEnd) * 100))}%`,
                }}
              />

              {railAnchors.map((anchor) => (
                <button
                  key={anchor.id}
                  type="button"
                  onClick={() => replayAnchor(anchor)}
                  aria-label={`Replay ${anchor.label} at ${formatClock(anchor.elapsed)}`}
                  className={`absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-zinc-100 shadow-[0_0_18px_rgba(244,244,245,0.38)] transition ${
                    anchor.id === lastPinnedId ? "scale-125 opacity-100" : "opacity-80"
                  }`}
                  style={{
                    left: `${anchor.position}%`,
                  }}
                >
                  <span className="absolute inset-1 rounded-full bg-black/85" />
                </button>
              ))}
            </div>
          </div>
        </footer>
      </section>
    </main>
  )
}
