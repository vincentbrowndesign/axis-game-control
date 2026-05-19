"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import MuxPlayer from "@mux/mux-player-react"

type LiveStatus =
  | "READY"
  | "STARTING"
  | "LIVE"
  | "RECONNECTING"
  | "FINALIZING"
  | "ARCHIVED"
  | "OFFLINE"

type MomentAnchor = {
  id: string
  elapsed: number
  label: string
}

const anchorStorageKey = "axis-live-thread-anchors"
const clockStorageKey = "axis-live-thread-started-at"
const reconnectDebounceMs = 1800

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
  const [status, setStatus] = useState<LiveStatus>("READY")
  const [muxPlaying, setMuxPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [anchors, setAnchors] = useState<MomentAnchor[]>([])
  const [lastPinnedId, setLastPinnedId] = useState("")
  const [threadHydrated, setThreadHydrated] = useState(false)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const sessionIdRef = useRef("")
  const chunkQueueRef = useRef<Promise<void>>(Promise.resolve())
  const startedRef = useRef(false)
  const finalizingRef = useRef(false)
  const reconnectTimerRef = useRef<number | null>(null)
  const elapsedRef = useRef(0)
  const clockStartedAtRef = useRef(0)

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
      label: status,
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
    if (status === "ARCHIVED") return "bg-zinc-100 shadow-[0_0_14px_rgba(244,244,245,0.42)]"
    return "bg-zinc-200/70 shadow-[0_0_16px_rgba(244,244,245,0.28)]"
  }, [status])

  const absorbInterruption = () => {
    if (finalizingRef.current) return

    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
    }

    reconnectTimerRef.current = window.setTimeout(() => {
      if (!finalizingRef.current) setStatus("RECONNECTING")
    }, reconnectDebounceMs)
  }

  const stabilizeTransport = () => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    if (!finalizingRef.current) setStatus("LIVE")
  }

  const finalizeThread = () => {
    if (finalizingRef.current) return

    finalizingRef.current = true
    setStatus("FINALIZING")

    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") {
      recorder.requestData()
      recorder.stop()
    }

    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null

    const sessionId = sessionIdRef.current
    sessionIdRef.current = ""

    const complete = () => {
      window.sessionStorage.removeItem(clockStorageKey)
      setStatus("ARCHIVED")
    }

    if (!sessionId) {
      window.setTimeout(complete, 320)
      return
    }

    fetch("/api/live/stop", {
      method: "POST",
      headers: {
        "x-axis-live-session": sessionId,
      },
      keepalive: true,
    })
      .catch(() => undefined)
      .finally(() => window.setTimeout(complete, 320))
  }

  useEffect(() => {
    if (
      startedRef.current ||
      typeof window === "undefined" ||
      typeof navigator === "undefined"
    ) {
      return
    }

    let cancelled = false

    async function postChunk(chunk: Blob) {
      const sessionId = sessionIdRef.current

      if (cancelled || finalizingRef.current || !sessionId || !chunk.size) return

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
        absorbInterruption()
        return
      }

      stabilizeTransport()
    }

    async function startLiveCamera() {
      startedRef.current = true
      setStatus("STARTING")

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("OFFLINE")
        return
      }

      const localStream = await navigator.mediaDevices.getUserMedia({
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
      localStreamRef.current = localStream

      if (cancelled) {
        localStream.getTracks().forEach((track) => track.stop())
        return
      }

      localStream.getTracks().forEach((track) => {
        track.addEventListener("ended", absorbInterruption)
        track.addEventListener("mute", absorbInterruption)
        track.addEventListener("unmute", stabilizeTransport)
      })

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream
        await localVideoRef.current.play().catch(() => undefined)
      }

      const startResponse = await fetch("/api/live/start", {
        method: "POST",
      })

      if (!startResponse.ok) {
        setStatus("OFFLINE")
        return
      }

      const startData = (await startResponse.json()) as {
        sessionId?: string
        playbackId?: string
      }

      if (!startData.sessionId) {
        absorbInterruption()
        return
      }

      sessionIdRef.current = startData.sessionId
      setPlaybackId(startData.playbackId || fallbackPlaybackId)

      const recorderType = getRecorderType()

      if (typeof MediaRecorder === "undefined") {
        absorbInterruption()
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
        if (!event.data.size || finalizingRef.current) return

        chunkQueueRef.current = chunkQueueRef.current
          .then(() => postChunk(event.data))
          .catch(() => {
            absorbInterruption()
          })
      }
      recorder.onerror = absorbInterruption
      recorder.onpause = absorbInterruption
      recorder.onresume = stabilizeTransport
      recorder.onstart = stabilizeTransport
      recorder.onstop = () => {
        if (finalizingRef.current) return
        absorbInterruption()
      }
      recorderRef.current = recorder
      recorder.start(1200)
    }

    startLiveCamera().catch(() => {
      if (localStreamRef.current) absorbInterruption()
      else setStatus("OFFLINE")
    })

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") absorbInterruption()
      else stabilizeTransport()
    }
    const handlePageHide = () => {
      if (!finalizingRef.current) absorbInterruption()
    }
    const handleBeforeUnload = () => {
      if (sessionIdRef.current) {
        fetch("/api/live/stop", {
          method: "POST",
          headers: {
            "x-axis-live-session": sessionIdRef.current,
          },
          keepalive: true,
        }).catch(() => undefined)
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("pagehide", handlePageHide)
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("pagehide", handlePageHide)
      window.removeEventListener("beforeunload", handleBeforeUnload)

      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop()
      }

      localStreamRef.current?.getTracks().forEach((track) => {
        track.removeEventListener("ended", absorbInterruption)
        track.removeEventListener("mute", absorbInterruption)
        track.removeEventListener("unmute", stabilizeTransport)
        track.stop()
      })
      localStreamRef.current = null

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
          onPlaying={() => {
            setMuxPlaying(true)
            stabilizeTransport()
          }}
          onError={() => {
            setMuxPlaying(false)
            absorbInterruption()
          }}
          onStalled={absorbInterruption}
          onWaiting={absorbInterruption}
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

        {!playbackId && status === "OFFLINE" ? (
          <div className="absolute inset-0 z-10 grid place-items-center px-6 text-center">
            <div>
              <p className="text-3xl font-black uppercase tracking-[-0.04em] text-zinc-100 sm:text-5xl">
                OFFLINE
              </p>
            </div>
          </div>
        ) : null}

        <header className="absolute left-4 right-4 top-4 z-20 border-b border-white/10 bg-black/42 px-4 py-3 backdrop-blur-md">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
            <p className="text-[11px] font-black uppercase tracking-[0.26em] text-zinc-100">
              AXIS
            </p>
            <div className="h-px bg-gradient-to-r from-white/24 via-white/10 to-white/24" />
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${liveDotClass}`} />
              <span className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-100">
                {status}
              </span>
            </div>
          </div>
        </header>

        <footer className="absolute bottom-5 left-4 right-4 z-20">
          <div className="mx-auto max-w-4xl">
            <div className="mb-4 flex justify-center">
              <button
                type="button"
                onClick={pinMoment}
                disabled={status === "FINALIZING" || status === "ARCHIVED"}
                className="border border-white/10 bg-zinc-100/90 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition active:scale-95 disabled:opacity-40"
              >
                Mark
              </button>
              <button
                type="button"
                onClick={pinMoment}
                disabled={status === "FINALIZING" || status === "ARCHIVED"}
                className="border-y border-r border-white/10 bg-black/58 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-100 shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition active:scale-95 disabled:opacity-40"
              >
                Snapshot
              </button>
              <button
                type="button"
                onClick={finalizeThread}
                disabled={status === "FINALIZING" || status === "ARCHIVED"}
                className="border-y border-r border-white/10 bg-black/58 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-100 shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition active:scale-95 disabled:opacity-40"
              >
                End
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
