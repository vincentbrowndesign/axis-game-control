"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import MuxPlayer from "@mux/mux-player-react"

type LiveStatus =
  | "READY"
  | "STARTING"
  | "LIVE"
  | "RECONNECTING"
  | "FINALIZING"
  | "ARCHIVED"
  | "SESSION STORED"
  | "OFFLINE"

type MemoryEventType = "MARK" | "SNAPSHOT" | "SYSTEM" | "score" | "clock"

type EventBase = {
  id: string
  elapsed: number
  label: string
  createdAt: string
}

type BaseMemoryEvent = EventBase & {
  type: "MARK" | "SNAPSHOT" | "SYSTEM"
}

type ScoreEvent = EventBase & {
  type: "score"
  team: "HOME" | "AWAY"
  points: 1 | 2 | 3
  gameClock: string
  period: number
  sessionTime: number
}

type ClockEvent = EventBase & {
  type: "clock"
  action: "START" | "PAUSE" | "RESET"
  gameClock: string
  period: number
  sessionTime: number
}

type MemoryEvent =
  | BaseMemoryEvent
  | ScoreEvent
  | ClockEvent

type LiveThreadSession = {
  id: string
  createdAt: string
  endedAt: string
  duration: number
  videoAssetUrl: string | null
  replayAsset: {
    playbackId: string | null
    liveSessionId: string | null
  }
  markers: MemoryEvent[]
  snapshots: MemoryEvent[]
  scoringEvents: ScoreEvent[]
  scoreHistory: ScoreEvent[]
  clockHistory: ClockEvent[]
  eventTimeline: MemoryEvent[]
  systemStates: Array<{
    state: LiveStatus
    elapsed: number
    at: string
  }>
  inference: {
    pending: true
  }
}

const eventStorageKey = "axis-live-thread-events"
const sessionStorageKey = "axis-live-thread-started-at"
const archiveStorageKey = "axis-live-thread-archive"
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

function formatGameClock(totalSeconds: number) {
  return formatClock(Math.max(0, totalSeconds))
}

function eventWeight(type: MemoryEventType) {
  if (type === "score") return 2
  if (type === "SNAPSHOT") return 3
  if (type === "SYSTEM") return 1.5
  if (type === "clock") return 0.75
  return 1
}

function eventNodeClass(event: MemoryEvent) {
  if (event.type === "score") {
    const points = "points" in event ? event.points : 1
    if (points === 3) {
      return "h-6 w-6 border-emerald-100/60 bg-emerald-100 shadow-[0_0_24px_rgba(167,243,208,0.52)]"
    }
    if (points === 2) {
      return "h-5 w-5 border-emerald-100/45 bg-emerald-100/90 shadow-[0_0_20px_rgba(167,243,208,0.4)]"
    }
    return "h-3.5 w-3.5 border-emerald-100/35 bg-emerald-100/80 shadow-[0_0_16px_rgba(167,243,208,0.3)]"
  }

  if (event.type === "clock") {
    return "h-2 w-2 border-zinc-100/25 bg-zinc-100/60 shadow-[0_0_10px_rgba(244,244,245,0.24)]"
  }

  const type = event.type

  if (type === "SNAPSHOT") {
    return "h-5 w-5 border-white/50 bg-zinc-100 shadow-[0_0_22px_rgba(244,244,245,0.48)]"
  }

  if (type === "SYSTEM") {
    return "h-3 w-3 border-amber-100/35 bg-amber-100/80 shadow-[0_0_16px_rgba(253,230,138,0.28)]"
  }

  return "h-2.5 w-2.5 border-white/25 bg-zinc-100/90 shadow-[0_0_14px_rgba(244,244,245,0.32)]"
}

function loadStoredEvents(nowElapsed: number) {
  try {
    const storedEvents = window.localStorage.getItem(eventStorageKey)
    const parsedEvents = storedEvents
      ? (JSON.parse(storedEvents) as MemoryEvent[])
      : []

    if (!Array.isArray(parsedEvents)) return []

    return parsedEvents
      .filter(
        (event) =>
          typeof event.id === "string" &&
          typeof event.elapsed === "number" &&
            event.elapsed >= 0 &&
            event.elapsed <= nowElapsed + 10 &&
            typeof event.label === "string" &&
            ["MARK", "SNAPSHOT", "SYSTEM", "score", "clock"].includes(event.type)
      )
      .slice(-48)
  } catch {
    window.localStorage.removeItem(eventStorageKey)
    return []
  }
}

function archiveSession(session: LiveThreadSession) {
  const storedArchive = window.localStorage.getItem(archiveStorageKey)
  const parsedArchive = storedArchive
    ? (JSON.parse(storedArchive) as LiveThreadSession[])
    : []
  const archive = Array.isArray(parsedArchive) ? parsedArchive : []

  window.localStorage.setItem(
    archiveStorageKey,
    JSON.stringify([session, ...archive].slice(0, 12))
  )
}

export function LiveMemoryStream() {
  const fallbackPlaybackId = process.env.NEXT_PUBLIC_MUX_PLAYBACK_ID || ""
  const [playbackId, setPlaybackId] = useState(fallbackPlaybackId)
  const [status, setStatus] = useState<LiveStatus>("READY")
  const [muxPlaying, setMuxPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [period] = useState(1)
  const [gameClockSeconds, setGameClockSeconds] = useState(12 * 60)
  const [clockRunning, setClockRunning] = useState(false)
  const [events, setEvents] = useState<MemoryEvent[]>([])
  const [lastEventId, setLastEventId] = useState("")
  const [threadHydrated, setThreadHydrated] = useState(false)
  const [archivedSession, setArchivedSession] = useState<LiveThreadSession | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const liveSessionIdRef = useRef("")
  const chunkQueueRef = useRef<Promise<void>>(Promise.resolve())
  const startedRef = useRef(false)
  const finalizingRef = useRef(false)
  const reconnectTimerRef = useRef<number | null>(null)
  const elapsedRef = useRef(0)
  const clockStartedAtRef = useRef(0)
  const eventSequenceRef = useRef(0)
  const systemStatesRef = useRef<LiveThreadSession["systemStates"]>([])

  const railEnd = useMemo(() => Math.max(60, elapsed), [elapsed])
  const markers = useMemo(
    () => events.filter((event) => event.type === "MARK"),
    [events]
  )
  const snapshots = useMemo(
    () => events.filter((event) => event.type === "SNAPSHOT"),
    [events]
  )
  const scoringEvents = useMemo(
    () => events.filter((event): event is ScoreEvent => event.type === "score"),
    [events]
  )
  const clockEvents = useMemo(
    () => events.filter((event): event is ClockEvent => event.type === "clock"),
    [events]
  )
  const memoryDensity = useMemo(() => {
    const buckets = Array.from({ length: 18 }, (_, index) => ({
      id: `density-${index}`,
      left: (index / 18) * 100,
      width: 100 / 18,
      value: 0,
    }))

    for (const event of events) {
      const index = Math.min(
        buckets.length - 1,
        Math.max(0, Math.floor((event.elapsed / railEnd) * buckets.length))
      )
      const scoreWeight =
        event.type === "score" && "points" in event ? event.points : eventWeight(event.type)
      buckets[index].value += scoreWeight
    }

    return buckets
  }, [events, railEnd])
  const railEvents = useMemo(
    () =>
      events.map((event) => ({
        ...event,
        position: Math.min(98, Math.max(2, (event.elapsed / railEnd) * 100)),
      })),
    [events, railEnd]
  )
  const liveDotClass = useMemo(() => {
    if (status === "LIVE") {
      return "bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.85)]"
    }
    if (status === "RECONNECTING") {
      return "bg-amber-200/80 shadow-[0_0_22px_rgba(252,211,77,0.42)]"
    }
    if (status === "ARCHIVED" || status === "SESSION STORED") {
      return "bg-zinc-100 shadow-[0_0_14px_rgba(244,244,245,0.42)]"
    }
    return "bg-zinc-200/70 shadow-[0_0_16px_rgba(244,244,245,0.28)]"
  }, [status])

  const setSystemStatus = useCallback((nextStatus: LiveStatus) => {
    setStatus(nextStatus)
    systemStatesRef.current = [
      ...systemStatesRef.current,
      {
        state: nextStatus,
        elapsed: elapsedRef.current,
        at: new Date().toISOString(),
      },
    ].slice(-80)
  }, [])

  const createEventId = (prefix: string) => {
    eventSequenceRef.current += 1
    return `${prefix}-${Math.floor(elapsedRef.current * 1000).toString(36)}-${eventSequenceRef.current}`
  }

  const addMemoryEvent = (type: "MARK" | "SNAPSHOT" | "SYSTEM") => {
    if (status === "FINALIZING" || status === "ARCHIVED" || status === "SESSION STORED") {
      return
    }

    const event: MemoryEvent = {
      id: createEventId(`memory-${type.toLowerCase()}`),
      type,
      elapsed: elapsedRef.current,
      label: type,
      createdAt: new Date().toISOString(),
    }

    setEvents((current) => [...current.slice(-47), event])
    setLastEventId(event.id)
  }

  const addScoreEvent = (team: "HOME" | "AWAY", points: 1 | 2 | 3) => {
    if (status === "FINALIZING" || status === "ARCHIVED" || status === "SESSION STORED") {
      return
    }

    const nextScoreEvent: ScoreEvent = {
      id: createEventId(`score-${team.toLowerCase()}-${points}`),
      type: "score",
      team,
      points,
      gameClock: formatGameClock(gameClockSeconds),
      period,
      createdAt: new Date().toISOString(),
      sessionTime: elapsedRef.current,
      elapsed: elapsedRef.current,
      label: `${team} +${points}`,
    }

    if (team === "HOME") {
      setHomeScore((score) => score + points)
    } else {
      setAwayScore((score) => score + points)
    }

    setEvents((current) => [...current.slice(-47), nextScoreEvent])
    setLastEventId(nextScoreEvent.id)
  }

  const addClockEvent = (action: ClockEvent["action"]) => {
    const nextClockEvent: ClockEvent = {
      id: createEventId(`clock-${action.toLowerCase()}`),
      type: "clock",
      action,
      gameClock: formatGameClock(gameClockSeconds),
      period,
      createdAt: new Date().toISOString(),
      sessionTime: elapsedRef.current,
      elapsed: elapsedRef.current,
      label: action,
    }

    setEvents((current) => [...current.slice(-47), nextClockEvent])
    setLastEventId(nextClockEvent.id)
  }

  const startGameClock = () => {
    setClockRunning(true)
    addClockEvent("START")
  }

  const pauseGameClock = () => {
    setClockRunning(false)
    addClockEvent("PAUSE")
  }

  const resetGameClock = () => {
    setClockRunning(false)
    setGameClockSeconds(12 * 60)
    addClockEvent("RESET")
  }

  const replayEvent = (event: MemoryEvent) => {
    const player = surfaceRef.current?.querySelector("mux-player") as
      | (HTMLElement & {
          currentTime?: number
          play?: () => Promise<void> | void
        })
      | null

    if (!player || typeof player.currentTime !== "number") return

    const secondsBack = Math.max(0, elapsedRef.current - event.elapsed)
    player.currentTime = Math.max(0, player.currentTime - secondsBack)
    setLastEventId(event.id)
    const playResult = player.play?.()

    if (playResult instanceof Promise) {
      playResult.catch(() => undefined)
    }
  }

  const absorbInterruption = useCallback(() => {
    if (finalizingRef.current) return

    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
    }

    reconnectTimerRef.current = window.setTimeout(() => {
      if (!finalizingRef.current) setSystemStatus("RECONNECTING")
    }, reconnectDebounceMs)
  }, [setSystemStatus])

  const stabilizeTransport = useCallback(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    if (!finalizingRef.current) setSystemStatus("LIVE")
  }, [setSystemStatus])

  const finalizeThread = () => {
    if (finalizingRef.current) return

    finalizingRef.current = true
    setSystemStatus("FINALIZING")
    addMemoryEvent("SYSTEM")

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

    const liveSessionId = liveSessionIdRef.current
    liveSessionIdRef.current = ""

    const complete = () => {
      const endedAt = new Date().toISOString()
      const eventTimeline = [...events, {
        id: createEventId("memory-system"),
        type: "SYSTEM" as const,
        elapsed: elapsedRef.current,
        label: "ARCHIVED",
        createdAt: endedAt,
      }]
      const session: LiveThreadSession = {
        id: createEventId("session"),
        createdAt: new Date(clockStartedAtRef.current).toISOString(),
        endedAt,
        duration: elapsedRef.current,
        videoAssetUrl: playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null,
        replayAsset: {
          playbackId: playbackId || null,
          liveSessionId: liveSessionId || null,
        },
        markers: eventTimeline.filter((event) => event.type === "MARK"),
        snapshots: eventTimeline.filter((event) => event.type === "SNAPSHOT"),
        scoringEvents: eventTimeline.filter(
          (event): event is ScoreEvent => event.type === "score"
        ),
        scoreHistory: scoringEvents,
        clockHistory: clockEvents,
        eventTimeline,
        systemStates: systemStatesRef.current,
        inference: {
          pending: true,
        },
      }

      archiveSession(session)
      setArchivedSession(session)
      window.localStorage.removeItem(eventStorageKey)
      window.sessionStorage.removeItem(sessionStorageKey)
      setSystemStatus("ARCHIVED")
      window.setTimeout(() => setSystemStatus("SESSION STORED"), 700)
    }

    if (!liveSessionId) {
      window.setTimeout(complete, 420)
      return
    }

    fetch("/api/live/stop", {
      method: "POST",
      headers: {
        "x-axis-live-session": liveSessionId,
      },
      keepalive: true,
    })
      .catch(() => undefined)
      .finally(() => window.setTimeout(complete, 420))
  }

  useEffect(() => {
    const now = Date.now()
    const storedClock = window.sessionStorage.getItem(sessionStorageKey)
    const storedClockValue = storedClock ? Number(storedClock) : 0
    const safeClock =
      storedClockValue > 0 && storedClockValue <= now ? storedClockValue : now

    clockStartedAtRef.current = safeClock
    window.sessionStorage.setItem(sessionStorageKey, String(safeClock))

    let storedEvents: MemoryEvent[] = []

    try {
      storedEvents = loadStoredEvents((now - safeClock) / 1000)
    } catch {
      window.localStorage.removeItem(eventStorageKey)
    }

    const hydrationTimer = window.setTimeout(() => {
      setEvents(storedEvents)
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

    window.localStorage.setItem(eventStorageKey, JSON.stringify(events.slice(-48)))
  }, [events, threadHydrated])

  useEffect(() => {
    if (!lastEventId) return

    const timeout = window.setTimeout(() => setLastEventId(""), 1600)

    return () => window.clearTimeout(timeout)
  }, [lastEventId])

  useEffect(() => {
    if (!clockRunning) return

    const timer = window.setInterval(() => {
      setGameClockSeconds((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer)
          return 0
        }

        return seconds - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [clockRunning])

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
      const liveSessionId = liveSessionIdRef.current

      if (cancelled || finalizingRef.current || !liveSessionId || !chunk.size) {
        return
      }

      const response = await fetch("/api/live/chunk", {
        method: "POST",
        headers: {
          "content-type": chunk.type || "application/octet-stream",
          "x-axis-live-session": liveSessionId,
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
      setSystemStatus("STARTING")

      if (!navigator.mediaDevices?.getUserMedia) {
        setSystemStatus("OFFLINE")
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
        setSystemStatus("OFFLINE")
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

      liveSessionIdRef.current = startData.sessionId
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
      else setSystemStatus("OFFLINE")
    })

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") absorbInterruption()
      else stabilizeTransport()
    }
    const handlePageHide = () => {
      if (!finalizingRef.current) absorbInterruption()
    }
    const handleBeforeUnload = () => {
      if (liveSessionIdRef.current) {
        fetch("/api/live/stop", {
          method: "POST",
          headers: {
            "x-axis-live-session": liveSessionIdRef.current,
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

      const liveSessionId = liveSessionIdRef.current
      if (liveSessionId) {
        fetch("/api/live/stop", {
          method: "POST",
          headers: {
            "x-axis-live-session": liveSessionId,
          },
          keepalive: true,
        }).catch(() => undefined)
      }

      liveSessionIdRef.current = ""
    }
  }, [absorbInterruption, fallbackPlaybackId, stabilizeTransport, setSystemStatus])

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
            <p className="text-3xl font-black uppercase tracking-[-0.04em] text-zinc-100 sm:text-5xl">
              OFFLINE
            </p>
          </div>
        ) : null}

        {(status === "ARCHIVED" || status === "SESSION STORED") && archivedSession ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/72 px-6 text-center backdrop-blur-sm">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">
                {status}
              </p>
              <p className="mt-5 text-5xl font-black uppercase tracking-[-0.06em] text-zinc-100 sm:text-7xl">
                {formatClock(archivedSession.duration)}
              </p>
              <div className="mt-6 flex justify-center gap-5 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">
                <span>{archivedSession.markers.length} markers</span>
                <span>{archivedSession.snapshots.length} snapshots</span>
              </div>
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
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
                Home
              </p>
              <p className="mt-1 text-4xl font-black leading-none tracking-[-0.06em] text-zinc-100">
                {homeScore}
              </p>
            </div>
            <div className="pb-1 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                Q{period} / {formatGameClock(gameClockSeconds)}
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={startGameClock}
                  disabled={clockRunning}
                  className="border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-200 disabled:opacity-35"
                >
                  Start
                </button>
                <button
                  type="button"
                  onClick={pauseGameClock}
                  disabled={!clockRunning}
                  className="border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-200 disabled:opacity-35"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={resetGameClock}
                  className="border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-200"
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
                Away
              </p>
              <p className="mt-1 text-4xl font-black leading-none tracking-[-0.06em] text-zinc-100">
                {awayScore}
              </p>
            </div>
          </div>
        </header>

        <footer className="absolute bottom-5 left-4 right-4 z-20">
          <div className="mx-auto max-w-4xl">
            <div className="mb-3 grid grid-cols-3 overflow-hidden border border-white/10 bg-black/58 backdrop-blur-md">
              {[1, 2, 3].map((points) => (
                <button
                  key={`home-${points}`}
                  type="button"
                  onClick={() => addScoreEvent("HOME", points as 1 | 2 | 3)}
                  disabled={
                    status === "FINALIZING" ||
                    status === "ARCHIVED" ||
                    status === "SESSION STORED"
                  }
                  className="border-r border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-100 transition active:bg-white/10 disabled:opacity-40 last:border-r-0"
                >
                  Home +{points}
                </button>
              ))}
              {[1, 2, 3].map((points) => (
                <button
                  key={`away-${points}`}
                  type="button"
                  onClick={() => addScoreEvent("AWAY", points as 1 | 2 | 3)}
                  disabled={
                    status === "FINALIZING" ||
                    status === "ARCHIVED" ||
                    status === "SESSION STORED"
                  }
                  className="border-r border-t border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-100 transition active:bg-white/10 disabled:opacity-40 last:border-r-0"
                >
                  Away +{points}
                </button>
              ))}
            </div>

            <div className="mb-4 flex justify-center">
              <button
                type="button"
                onClick={() => addMemoryEvent("MARK")}
                disabled={
                  status === "FINALIZING" ||
                  status === "ARCHIVED" ||
                  status === "SESSION STORED"
                }
                className="border border-white/10 bg-zinc-100/90 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition active:scale-95 disabled:opacity-40"
              >
                Mark
              </button>
              <button
                type="button"
                onClick={() => addMemoryEvent("SNAPSHOT")}
                disabled={
                  status === "FINALIZING" ||
                  status === "ARCHIVED" ||
                  status === "SESSION STORED"
                }
                className="border-y border-r border-white/10 bg-black/58 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-100 shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition active:scale-95 disabled:opacity-40"
              >
                Snapshot
              </button>
              <button
                type="button"
                onClick={finalizeThread}
                disabled={
                  status === "FINALIZING" ||
                  status === "ARCHIVED" ||
                  status === "SESSION STORED"
                }
                className="border-y border-r border-white/10 bg-black/58 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-100 shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition active:scale-95 disabled:opacity-40"
              >
                End
              </button>
            </div>

            <div
              className={`relative h-12 overflow-hidden border border-white/10 bg-black/48 px-4 backdrop-blur-md transition-opacity duration-700 ${
                status === "LIVE" ? "opacity-100" : "opacity-75"
              }`}
            >
              <div className="absolute left-5 right-5 top-1/2 h-px -translate-y-1/2 bg-white/16" />
              {memoryDensity.map((bucket) => (
                <span
                  key={bucket.id}
                  className="absolute top-1/2 -translate-y-1/2 rounded-full bg-zinc-100/20 blur-[1px] transition-all duration-500"
                  style={{
                    left: `${bucket.left}%`,
                    width: `${bucket.width}%`,
                    height: `${Math.min(18, 2 + bucket.value * 4)}px`,
                    opacity: bucket.value ? Math.min(0.62, 0.18 + bucket.value * 0.12) : 0,
                  }}
                />
              ))}
              <div
                className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-emerald-200 shadow-[0_0_18px_rgba(167,243,208,0.72)] transition-all duration-500"
                style={{
                  left: `${Math.min(96, Math.max(4, (elapsed / railEnd) * 100))}%`,
                }}
              />

              {railEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => replayEvent(event)}
                  aria-label={`${event.type} at ${formatClock(event.elapsed)}`}
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border transition ${
                    lastEventId === event.id ? "scale-125 opacity-100" : "opacity-80"
                  } ${eventNodeClass(event)}`}
                  style={{
                    left: `${event.position}%`,
                  }}
                >
                  <span className="absolute inset-1 rounded-full bg-black/80" />
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">
              <span>{formatClock(elapsed)}</span>
              <span>
                {scoringEvents.length} score / {markers.length} mark / {snapshots.length} snapshot
              </span>
            </div>
          </div>
        </footer>
      </section>
    </main>
  )
}
