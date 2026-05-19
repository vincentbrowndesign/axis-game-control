"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import MuxPlayer from "@mux/mux-player-react"
import {
  appendTemporalEvent,
  buildArchiveMemory,
  buildLiveMemory,
  createTemporalEvent,
  createTemporalSession,
  isTemporalEvent,
  transitionTemporalSession,
  type ArchiveMemory,
  type GameClockState,
  type OperationalSessionState,
  type TemporalEvent,
  type TemporalEventType,
  type TemporalSession,
  type TransportState,
} from "@/lib/temporal/sessionEngine"

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

const disabledStates: OperationalSessionState[] = ["FINALIZING", "ARCHIVED", "FAILED"]

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

function eventNodeClass(event: TemporalEvent) {
  if (event.type === "score") {
    const points = Number(event.metadata.points || 1)
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

  if (event.type === "snapshot") {
    return "h-5 w-5 border-white/50 bg-zinc-100 shadow-[0_0_22px_rgba(244,244,245,0.48)]"
  }

  if (event.type === "system_state" || event.type === "reconnect") {
    return "h-3 w-3 border-amber-100/35 bg-amber-100/80 shadow-[0_0_16px_rgba(253,230,138,0.28)]"
  }

  return "h-2.5 w-2.5 border-white/25 bg-zinc-100/90 shadow-[0_0_14px_rgba(244,244,245,0.32)]"
}

function sessionIdFromClock(clock: number) {
  return `axis-session-${Math.max(0, Math.floor(clock)).toString(36)}`
}

function loadStoredEvents(nowElapsed: number) {
  try {
    const storedEvents = window.localStorage.getItem(eventStorageKey)
    const parsedEvents = storedEvents ? (JSON.parse(storedEvents) as unknown[]) : []

    if (!Array.isArray(parsedEvents)) return []

    return parsedEvents.filter(
      (event): event is TemporalEvent =>
        isTemporalEvent(event) &&
        event.sessionTime >= 0 &&
        event.sessionTime <= nowElapsed + 10
    )
  } catch {
    window.localStorage.removeItem(eventStorageKey)
    return []
  }
}

function archiveSession(session: ArchiveMemory) {
  const storedArchive = window.localStorage.getItem(archiveStorageKey)
  const parsedArchive = storedArchive ? (JSON.parse(storedArchive) as ArchiveMemory[]) : []
  const archive = Array.isArray(parsedArchive) ? parsedArchive : []

  window.localStorage.setItem(archiveStorageKey, JSON.stringify([session, ...archive].slice(0, 12)))
}

export function LiveMemoryStream() {
  const fallbackPlaybackId = process.env.NEXT_PUBLIC_MUX_PLAYBACK_ID || ""
  const [playbackId, setPlaybackId] = useState(fallbackPlaybackId)
  const [status, setStatus] = useState<OperationalSessionState>("READY")
  const [muxPlaying, setMuxPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [period] = useState(1)
  const [gameClockSeconds, setGameClockSeconds] = useState(12 * 60)
  const [clockState, setClockState] = useState<GameClockState>("STOPPED")
  const [events, setEvents] = useState<TemporalEvent[]>([])
  const [lastEventId, setLastEventId] = useState("")
  const [threadHydrated, setThreadHydrated] = useState(false)
  const [archivedSession, setArchivedSession] = useState<ArchiveMemory | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const liveSessionIdRef = useRef("")
  const chunkQueueRef = useRef<Promise<void>>(Promise.resolve())
  const startedRef = useRef(false)
  const finalizingRef = useRef(false)
  const reconnectTimerRef = useRef<number | null>(null)
  const recoveryTimerRef = useRef<number | null>(null)
  const elapsedRef = useRef(0)
  const clockStartedAtRef = useRef(0)
  const gameClockSecondsRef = useRef(12 * 60)
  const clockStateRef = useRef<GameClockState>("STOPPED")
  const eventSequenceRef = useRef(0)
  const sessionRef = useRef<TemporalSession | null>(null)
  const statusRef = useRef<OperationalSessionState>("READY")
  const eventsRef = useRef<TemporalEvent[]>([])

  const railEnd = useMemo(() => Math.max(60, elapsed), [elapsed])
  const liveMemory = useMemo(() => {
    const session = createTemporalSession({
      id: "axis-session-pending",
      createdAt: "1970-01-01T00:00:00.000Z",
    })

    return buildLiveMemory({
      session: {
        ...session,
        duration: elapsed,
      },
      events,
    })
  }, [elapsed, events])
  const markers = useMemo(() => events.filter((event) => event.type === "marker"), [events])
  const snapshots = useMemo(
    () => events.filter((event) => event.type === "snapshot"),
    [events]
  )
  const scoringEvents = useMemo(
    () => events.filter((event) => event.type === "score"),
    [events]
  )
  const clockRunning = clockState === "RUNNING"
  const memoryDensity = useMemo(
    () =>
      liveMemory.rail.densityRegions.map((region) => ({
        id: region.id,
        left: Math.max(0, Math.min(100, (region.start / railEnd) * 100)),
        width: Math.max(2, Math.min(100, ((region.end - region.start) / railEnd) * 100)),
        value: region.weight,
      })),
    [liveMemory.rail.densityRegions, railEnd]
  )
  const eventById = useMemo(
    () => new Map(events.map((event) => [event.id, event])),
    [events]
  )
  const railEvents = useMemo(
    () => liveMemory.rail.nodes,
    [liveMemory.rail.nodes]
  )
  const liveDotClass = useMemo(() => {
    if (status === "LIVE") {
      return "bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.85)]"
    }
    if (status === "RECONNECTING" || status === "RECOVERING") {
      return "bg-amber-200/80 shadow-[0_0_22px_rgba(252,211,77,0.42)]"
    }
    if (status === "ARCHIVED") {
      return "bg-zinc-100 shadow-[0_0_14px_rgba(244,244,245,0.42)]"
    }
    if (status === "FAILED") {
      return "bg-red-300/80 shadow-[0_0_18px_rgba(252,165,165,0.5)]"
    }
    return "bg-zinc-200/70 shadow-[0_0_16px_rgba(244,244,245,0.28)]"
  }, [status])

  const getSession = useCallback(() => {
    if (sessionRef.current) return sessionRef.current

    const createdAt = new Date().toISOString()
    const session = createTemporalSession({
      id: sessionIdFromClock(clockStartedAtRef.current || Date.parse(createdAt)),
      createdAt,
    })

    sessionRef.current = session
    return session
  }, [])

  const appendEvent = useCallback((event: TemporalEvent) => {
    setEvents((current) => {
      const nextEvents = appendTemporalEvent(current, event)
      eventsRef.current = nextEvents
      return nextEvents
    })
    setLastEventId(event.id)
  }, [])

  const nextOrder = useCallback(() => {
    eventSequenceRef.current += 1
    return eventSequenceRef.current
  }, [])

  const createEvent = useCallback(
    ({
      type,
      team = null,
      source = "operator",
      metadata = {},
      gameClock = formatGameClock(gameClockSecondsRef.current),
      tier = "PRIMARY",
    }: {
      type: TemporalEventType
      team?: "HOME" | "AWAY" | null
      source?: "operator" | "system" | "transport" | "clock" | "future_inference"
      metadata?: Record<string, unknown>
      gameClock?: string
      tier?: "PRIMARY" | "SECONDARY" | "TERTIARY"
    }) =>
      createTemporalEvent({
        sessionId: getSession().id,
        type,
        tier,
        order: nextOrder(),
        createdAt: new Date().toISOString(),
        sessionTime: elapsedRef.current,
        gameClock,
        period,
        team,
        points: type === "score" ? Number(metadata.points) as 1 | 2 | 3 : undefined,
        clockState:
          type === "clock" && typeof metadata.clockState === "string"
            ? (metadata.clockState as GameClockState)
            : undefined,
        source,
        metadata,
      }),
    [getSession, nextOrder, period]
  )

  const setSystemStatus = useCallback(
    (
      nextStatus: OperationalSessionState,
      transportState?: TransportState,
      metadata: Record<string, unknown> = {}
    ) => {
      const previousStatus = statusRef.current
      const at = new Date().toISOString()
      const session = getSession()

      sessionRef.current = transitionTemporalSession({
        session,
        status: nextStatus,
        at,
        duration: elapsedRef.current,
        transportState,
        archiveState:
          nextStatus === "FINALIZING"
            ? "FINALIZING"
            : nextStatus === "ARCHIVED"
              ? "STORED"
              : nextStatus === "FAILED"
                ? "FAILED"
                : undefined,
      })
      statusRef.current = nextStatus
      setStatus(nextStatus)

      if (previousStatus === nextStatus) return

      appendEvent(
        createTemporalEvent({
          sessionId: session.id,
          type: nextStatus === "RECONNECTING" ? "reconnect" : "system_state",
          tier: "SECONDARY",
          order: nextOrder(),
          createdAt: at,
          sessionTime: elapsedRef.current,
          gameClock: formatGameClock(gameClockSecondsRef.current),
          period,
          team: null,
          source: "system",
          metadata: {
            ...metadata,
            state: nextStatus,
            previousState: previousStatus,
          },
        })
      )
    },
    [appendEvent, getSession, nextOrder, period]
  )

  const addMemoryEvent = (type: "marker" | "snapshot") => {
    if (disabledStates.includes(status)) return

    appendEvent(
      createEvent({
        type,
        metadata: {
          label: type === "marker" ? "MARK" : "SNAPSHOT",
        },
      })
    )
  }

  const addScoreEvent = (team: "HOME" | "AWAY", points: 1 | 2 | 3) => {
    if (disabledStates.includes(status)) return

    const nextHomeScore = team === "HOME" ? homeScore + points : homeScore
    const nextAwayScore = team === "AWAY" ? awayScore + points : awayScore

    if (team === "HOME") {
      setHomeScore(nextHomeScore)
    } else {
      setAwayScore(nextAwayScore)
    }

    appendEvent(
      createEvent({
        type: "score",
        team,
        metadata: {
          team,
          points,
          scoreAfter: {
            home: nextHomeScore,
            away: nextAwayScore,
          },
          scoreDifferential: nextHomeScore - nextAwayScore,
          gameClock: formatGameClock(gameClockSecondsRef.current),
          period,
        },
      })
    )
  }

  const addClockEvent = (
    clockState: GameClockState,
    clockOverride?: string,
    previousClockState = clockStateRef.current
  ) => {
    appendEvent(
      createEvent({
        type: "clock",
        source: "clock",
        gameClock: clockOverride || formatGameClock(gameClockSecondsRef.current),
        metadata: {
          action: clockState,
          clockState,
          previousClockState,
          gameClock: clockOverride || formatGameClock(gameClockSecondsRef.current),
          period,
        },
      })
    )
  }

  const startGameClock = () => {
    const previousClockState = clockStateRef.current
    clockStateRef.current = "RUNNING"
    setClockState("RUNNING")
    addClockEvent("RUNNING", undefined, previousClockState)
  }

  const pauseGameClock = () => {
    const previousClockState = clockStateRef.current
    clockStateRef.current = "PAUSED"
    setClockState("PAUSED")
    addClockEvent("PAUSED", undefined, previousClockState)
  }

  const resetGameClock = () => {
    const previousClockState = clockStateRef.current
    clockStateRef.current = "STOPPED"
    setClockState("STOPPED")
    gameClockSecondsRef.current = 12 * 60
    setGameClockSeconds(12 * 60)
    addClockEvent("STOPPED", "12:00", previousClockState)
  }

  const replayEvent = (event: TemporalEvent) => {
    const player = surfaceRef.current?.querySelector("mux-player") as
      | (HTMLElement & {
          currentTime?: number
          play?: () => Promise<void> | void
        })
      | null

    if (!player || typeof player.currentTime !== "number") return

    const secondsBack = Math.max(0, elapsedRef.current - event.sessionTime)
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
      if (!finalizingRef.current) setSystemStatus("RECONNECTING", "INTERRUPTED")
    }, reconnectDebounceMs)
  }, [setSystemStatus])

  const stabilizeTransport = useCallback(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    if (recoveryTimerRef.current) {
      window.clearTimeout(recoveryTimerRef.current)
      recoveryTimerRef.current = null
    }

    if (finalizingRef.current) return

    if (statusRef.current === "RECONNECTING") {
      setSystemStatus("RECOVERING", "RECOVERING")
      recoveryTimerRef.current = window.setTimeout(() => {
        if (!finalizingRef.current) setSystemStatus("LIVE", "PUBLISHING")
      }, 650)
      return
    }

    setSystemStatus("LIVE", "PUBLISHING")
  }, [setSystemStatus])

  const finalizeThread = () => {
    if (finalizingRef.current) return

    finalizingRef.current = true
    const previousClockState = clockStateRef.current
    clockStateRef.current = "FINALIZED"
    setClockState("FINALIZED")
    appendEvent(
      createEvent({
        type: "clock",
        source: "clock",
        gameClock: formatGameClock(gameClockSecondsRef.current),
        metadata: {
          action: "FINALIZED",
          clockState: "FINALIZED",
          previousClockState,
          gameClock: formatGameClock(gameClockSecondsRef.current),
          period,
        },
      })
    )
    setSystemStatus("FINALIZING", "CLOSED")

    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    if (recoveryTimerRef.current) {
      window.clearTimeout(recoveryTimerRef.current)
      recoveryTimerRef.current = null
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
      const sessionEnd = createTemporalEvent({
        sessionId: getSession().id,
        type: "session_end",
        tier: "PRIMARY",
        order: nextOrder(),
        createdAt: endedAt,
        sessionTime: elapsedRef.current,
        gameClock: formatGameClock(gameClockSecondsRef.current),
        period,
        team: null,
        source: "system",
        metadata: {
          state: "ARCHIVED",
        },
      })
      const eventTimeline = appendTemporalEvent(eventsRef.current, sessionEnd)
      const archivedTemporalSession = transitionTemporalSession({
        session: getSession(),
        status: "ARCHIVED",
        at: endedAt,
        duration: elapsedRef.current,
        transportState: "CLOSED",
        archiveState: "STORED",
      })
      sessionRef.current = archivedTemporalSession
      const archiveMemory = buildArchiveMemory({
        session: archivedTemporalSession,
        events: eventTimeline,
        playbackId: playbackId || null,
        liveSessionId: liveSessionId || null,
      })

      archiveSession(archiveMemory)
      setEvents(eventTimeline)
      setArchivedSession(archiveMemory)
      window.localStorage.removeItem(eventStorageKey)
      window.sessionStorage.removeItem(sessionStorageKey)
      statusRef.current = "ARCHIVED"
      setStatus("ARCHIVED")
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
    const createdAt = new Date(safeClock).toISOString()

    clockStartedAtRef.current = safeClock
    sessionRef.current = createTemporalSession({
      id: sessionIdFromClock(safeClock),
      createdAt,
    })
    window.sessionStorage.setItem(sessionStorageKey, String(safeClock))

    let storedEvents: TemporalEvent[] = []

    try {
      storedEvents = loadStoredEvents((now - safeClock) / 1000)
    } catch {
      window.localStorage.removeItem(eventStorageKey)
    }

    eventSequenceRef.current = storedEvents.reduce(
      (highest, event) => Math.max(highest, event.order),
      0
    )
    eventsRef.current = storedEvents

    const hydrationTimer = window.setTimeout(() => {
      setEvents((current) => {
        const nextEvents = storedEvents.reduce(
          (timeline, event) => appendTemporalEvent(timeline, event),
          current
        )
        eventsRef.current = nextEvents
        return nextEvents
      })
      setThreadHydrated(true)
    }, 0)

    const timer = window.setInterval(() => {
      const nextElapsed = (Date.now() - clockStartedAtRef.current) / 1000
      elapsedRef.current = nextElapsed
      if (sessionRef.current) {
        sessionRef.current = {
          ...sessionRef.current,
          duration: nextElapsed,
        }
      }
      setElapsed(nextElapsed)
    }, 1000)

    return () => {
      window.clearTimeout(hydrationTimer)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    eventsRef.current = events
  }, [events])

  useEffect(() => {
    if (!threadHydrated) return

    window.localStorage.setItem(eventStorageKey, JSON.stringify(events))
  }, [events, threadHydrated])

  useEffect(() => {
    if (!lastEventId) return

    const timeout = window.setTimeout(() => setLastEventId(""), 1600)

    return () => window.clearTimeout(timeout)
  }, [lastEventId])

  useEffect(() => {
    gameClockSecondsRef.current = gameClockSeconds
  }, [gameClockSeconds])

  useEffect(() => {
    if (!clockRunning) return

    const timer = window.setInterval(() => {
      setGameClockSeconds((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer)
          gameClockSecondsRef.current = 0
          return 0
        }

        const nextSeconds = seconds - 1
        gameClockSecondsRef.current = nextSeconds
        return nextSeconds
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
      setSystemStatus("STARTING", "ACQUIRING")

      appendEvent(
        createTemporalEvent({
          sessionId: getSession().id,
          type: "session_start",
          tier: "PRIMARY",
          order: nextOrder(),
          createdAt: new Date().toISOString(),
          sessionTime: elapsedRef.current,
          gameClock: formatGameClock(gameClockSecondsRef.current),
          period,
          team: null,
          source: "system",
          metadata: {
            state: "STARTING",
          },
        })
      )

      if (!navigator.mediaDevices?.getUserMedia) {
        setSystemStatus("FAILED", "FAILED")
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
        setSystemStatus("FAILED", "FAILED")
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
      else setSystemStatus("FAILED", "FAILED")
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

      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current)
      if (recoveryTimerRef.current) window.clearTimeout(recoveryTimerRef.current)

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
  }, [
    absorbInterruption,
    appendEvent,
    fallbackPlaybackId,
    getSession,
    nextOrder,
    period,
    setSystemStatus,
    stabilizeTransport,
  ])

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
            status === "RECONNECTING" || status === "RECOVERING"
              ? "bg-[radial-gradient(circle_at_50%_55%,rgba(251,191,36,0.08),transparent_38%)] opacity-100"
              : "opacity-0"
          }`}
        />

        {!playbackId && status === "FAILED" ? (
          <div className="absolute inset-0 z-10 grid place-items-center px-6 text-center">
            <p className="text-3xl font-black uppercase tracking-[-0.04em] text-zinc-100 sm:text-5xl">
              FAILED
            </p>
          </div>
        ) : null}

        {status === "ARCHIVED" && archivedSession ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/72 px-6 text-center backdrop-blur-sm">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">
                ARCHIVED
              </p>
              <p className="mt-5 text-5xl font-black uppercase tracking-[-0.06em] text-zinc-100 sm:text-7xl">
                {formatClock(archivedSession.session.duration)}
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
            <div className="mb-3 grid grid-cols-3 overflow-hidden border border-white/10 bg-black/52 backdrop-blur-sm">
              {[1, 2, 3].map((points) => (
                <button
                  key={`home-${points}`}
                  type="button"
                  onClick={() => addScoreEvent("HOME", points as 1 | 2 | 3)}
                  disabled={disabledStates.includes(status)}
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
                  disabled={disabledStates.includes(status)}
                  className="border-r border-t border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-100 transition active:bg-white/10 disabled:opacity-40 last:border-r-0"
                >
                  Away +{points}
                </button>
              ))}
            </div>

            <div className="mb-4 flex justify-center">
              <button
                type="button"
                onClick={() => addMemoryEvent("marker")}
                disabled={disabledStates.includes(status)}
                className="border border-white/10 bg-zinc-100/90 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-black transition active:bg-zinc-300 disabled:opacity-40"
              >
                Mark
              </button>
              <button
                type="button"
                onClick={() => addMemoryEvent("snapshot")}
                disabled={disabledStates.includes(status)}
                className="border-y border-r border-white/10 bg-black/52 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-100 transition active:bg-white/10 disabled:opacity-40"
              >
                Snapshot
              </button>
              <button
                type="button"
                onClick={finalizeThread}
                disabled={disabledStates.includes(status)}
                className="border-y border-r border-white/10 bg-black/52 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-100 transition active:bg-white/10 disabled:opacity-40"
              >
                End
              </button>
            </div>

            <div
              className={`relative h-12 overflow-hidden border border-white/10 bg-black/42 px-4 backdrop-blur-sm transition-opacity duration-700 ${
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

              {railEvents
                .filter((node) => node.layer === "SECONDARY")
                .map((node) => (
                  <span
                    key={node.id}
                    className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-amber-100/25 shadow-[0_0_12px_rgba(253,230,138,0.18)]"
                    style={{
                      left: `${node.position}%`,
                      opacity: Math.min(0.48, 0.12 + node.weight * 0.12),
                    }}
                  />
                ))}

              {railEvents
                .filter((node) => node.layer === "TERTIARY")
                .map((node) => (
                  <span
                    key={node.id}
                    className="absolute top-[calc(50%-10px)] h-2 w-8 -translate-x-1/2 rounded-full bg-sky-200/20 blur-[2px]"
                    style={{
                      left: `${node.position}%`,
                      opacity: Math.min(0.52, 0.16 + node.weight * 0.08),
                    }}
                  />
                ))}

              {railEvents
                .filter((node) => node.layer === "PRIMARY")
                .map((node) => {
                  const event = eventById.get(node.eventId)

                  if (!event) return null

                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => replayEvent(event)}
                      aria-label={`${node.label} at ${formatClock(node.sessionTime)}`}
                      className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border transition ${
                        lastEventId === node.eventId ? "scale-125 opacity-100" : "opacity-80"
                      } ${eventNodeClass(event)}`}
                      style={{
                        left: `${node.position}%`,
                      }}
                    >
                      <span className="absolute inset-1 rounded-full bg-black/80" />
                    </button>
                  )
                })}
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
