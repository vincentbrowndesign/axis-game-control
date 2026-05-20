"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react"
import Link from "next/link"
import { useShallow } from "zustand/react/shallow"
import {
  type AxisSnapshot,
  type TimelineAnchor,
  useAxisChronologyStore,
} from "@/lib/axisChronologyStore"
import {
  basketballEvents,
  reconstructionChapterForEvent,
  recordReplayNegotiation,
  type BasketballEvent,
  type BasketballReconstructionChapter,
} from "@/lib/continuityAssistance"
import { captureVideoFrameBlob } from "@/lib/snapshotCapture"
import { summarizeNearbyEvents } from "@/lib/trainingSetMemory"
import type {
  TemporalEventRecord,
  TemporalSessionRecord,
  TemporalSnapshotRecord,
} from "@/lib/temporalEventGraph"

type SessionPayload = {
  ok?: boolean
  events?: TemporalEventRecord[]
  snapshots?: TemporalSnapshotRecord[]
  trainingMemories?: TrainingMemoryRecord[]
}

type InspectionDepth = 0.5 | 1 | 2 | 2.5
type RitualPhase = "apprentice" | "practitioner" | "mastery"
type RitualIntent = "Observe" | "Watch" | "Link" | "Mark" | "Again"

const inspectionDepths: InspectionDepth[] = [0.5, 1, 2, 2.5]
const ritualStorageKey = "axis:replay-room-ritual-count:v1"

type TrainingMemoryRecord = {
  id: string
  session_id: string
  label: string
  frame_url: string
  video_url: string | null
  replay_time: number
  clip_start: number | null
  clip_end: number | null
  event_type: string | null
  metadata: Record<string, unknown>
  roboflow_status: string
  roboflow_response: unknown
  created_at: string
}

function formatClock(totalSeconds: number | null | undefined) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function formatPreciseClock(totalSeconds: number | null | undefined) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = Math.floor(safeSeconds % 60)
  const centiseconds = Math.floor((safeSeconds % 1) * 100)

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`
}

function formatEnvironmentalTimestamp(value: string | null | undefined) {
  if (!value) return "TIME_UNSET"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const month = date
    .toLocaleString("en-US", {
      month: "short",
    })
    .toUpperCase()
  const day = date.getDate().toString().padStart(2, "0")
  const hour = date.getHours()
  const displayHour = hour % 12 || 12
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const meridiem = hour >= 12 ? "PM" : "AM"

  return `${month}_${day}_${displayHour}:${minutes}_${meridiem}`
}

function compactNodeId(sessionId: string) {
  const compact = sessionId.replace(/[^a-z0-9]/gi, "").toUpperCase()
  const suffix = compact.slice(-4) || "0000"

  return `AXS-${suffix}`
}

function memoryProgressionContext(memory: TrainingMemoryRecord) {
  const metadata = memory.metadata || {}

  if (typeof metadata.reconstructionChapter === "string") return metadata.reconstructionChapter
  if (typeof metadata.basketballEvent === "string") return metadata.basketballEvent
  if (typeof metadata.eventType === "string") return metadata.eventType

  return "SAVED"
}

function trainingLabelFromEvent(event: TemporalEventRecord | undefined) {
  const basketballEvent = event?.payload?.basketball_event

  if (basketballEvent === "MAKE") return "make"
  if (basketballEvent === "MISS") return "miss"
  if (basketballEvent === "SHOT") return "release"

  return "other"
}

function pulseHaptic(pattern: number | number[] = 8) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return
  navigator.vibrate(pattern)
}

function memoryDensityAt(time: number, anchors: Array<{ time: number; weight?: number }>, duration: number) {
  const safeDuration = Math.max(duration, 1)
  const influenceWindow = Math.max(4, safeDuration * 0.08)

  return anchors.reduce((density, anchor) => {
    const distance = Math.abs(anchor.time - time)
    if (distance > influenceWindow) return density

    const proximity = 1 - distance / influenceWindow
    return density + proximity * (anchor.weight || 1)
  }, 0)
}

function hapticForDensity(density: number) {
  if (density >= 2.4) return [18, 26, 14]
  if (density >= 1.35) return [12, 18, 8]
  return 7
}

function phaseForRitualCount(count: number): RitualPhase {
  if (count >= 36) return "mastery"
  if (count >= 14) return "practitioner"
  return "apprentice"
}

function readRitualPhase() {
  if (typeof window === "undefined") return "apprentice" as RitualPhase

  const count = Number(window.localStorage.getItem(ritualStorageKey)) || 0
  return phaseForRitualCount(count)
}

function markRitualPractice() {
  if (typeof window === "undefined") return "apprentice" as RitualPhase

  const count = (Number(window.localStorage.getItem(ritualStorageKey)) || 0) + 1
  window.localStorage.setItem(ritualStorageKey, String(count))

  return phaseForRitualCount(count)
}

export function seekToEvent(
  videoElement: HTMLVideoElement | null,
  anchor: TimelineAnchor | null
) {
  if (!videoElement || !anchor) return

  videoElement.pause()
  videoElement.currentTime = anchor.targetTime
}

function waitForSeeked(videoElement: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    const handleSeeked = () => {
      window.clearTimeout(timeout)
      resolve()
    }
    const timeout = window.setTimeout(() => {
      videoElement.removeEventListener("seeked", handleSeeked)
      resolve()
    }, 2500)

    videoElement.addEventListener("seeked", handleSeeked, {
      once: true,
    })
  })
}

function RadialIntentField({
  x,
  y,
  phase,
  onCommit,
}: {
  x: number
  y: number
  phase: RitualPhase
  onCommit: (intent: RitualIntent) => void
}) {
  const fieldRef = useRef<HTMLDivElement | null>(null)
  const intents: Array<{
    label: RitualIntent
    angle: number
  }> = [
    {
      label: "Observe",
      angle: -Math.PI / 2,
    },
    {
      label: "Watch",
      angle: -Math.PI / 5,
    },
    {
      label: "Link",
      angle: Math.PI / 5,
    },
    {
      label: "Mark",
      angle: Math.PI / 2,
    },
    {
      label: "Again",
      angle: Math.PI,
    },
  ]
  const radius = phase === "mastery" ? 58 : phase === "practitioner" ? 68 : 78
  const opacity = phase === "mastery" ? "opacity-36" : phase === "practitioner" ? "opacity-58" : "opacity-78"

  const commitFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = fieldRef.current?.getBoundingClientRect()
    if (!bounds) return

    const centerX = bounds.left + bounds.width / 2
    const centerY = bounds.top + bounds.height / 2
    const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX)
    const nearest = intents.reduce(
      (selected, intent) => {
        const delta = Math.abs(Math.atan2(Math.sin(angle - intent.angle), Math.cos(angle - intent.angle)))
        return delta < selected.delta
          ? {
              delta,
              intent: intent.label,
            }
          : selected
      },
      {
        delta: Number.POSITIVE_INFINITY,
        intent: "Mark" as RitualIntent,
      }
    )

    onCommit(nearest.intent)
  }

  return (
    <div
      ref={fieldRef}
      className={`pointer-events-auto absolute z-50 h-52 w-52 -translate-x-1/2 -translate-y-1/2 touch-none ${opacity}`}
      style={{
        left: x,
        top: y,
      }}
      onPointerUp={commitFromPointer}
      onPointerCancel={() => onCommit("Observe")}
    >
      <div className="absolute inset-1/2 h-px w-px bg-[#f2f1ed]/40 shadow-[0_0_28px_rgba(242,241,237,0.24)]" />
      {intents.map((intent) => {
        const left = 50 + (Math.cos(intent.angle) * radius) / 2
        const top = 50 + (Math.sin(intent.angle) * radius) / 2

        return (
          <span
            key={intent.label}
            className="axis-mono pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-[0.16em] text-[#f2f1ed]/70"
            style={{
              left: `${left}%`,
              top: `${top}%`,
            }}
          >
            {intent.label}
          </span>
        )
      })}
    </div>
  )
}

function ReplayVideo({
  playbackUrl,
  inspectionDepth,
  session,
  ritualPhase,
  onRitualPractice,
  onTrainingMemoryStored,
}: {
  playbackUrl: string | null
  inspectionDepth: InspectionDepth
  session: TemporalSessionRecord
  ritualPhase: RitualPhase
  onRitualPractice: () => void
  onTrainingMemoryStored: (memory: TrainingMemoryRecord) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const seekVersionRef = useRef(0)
  const tapTimerRef = useRef<number | null>(null)
  const holdTimerRef = useRef<number | null>(null)
  const radialTimerRef = useRef<number | null>(null)
  const playbackClockFrameRef = useRef<number | null>(null)
  const resumeAfterSeekRef = useRef(false)
  const holdTriggeredRef = useRef(false)
  const [trainingStatus, setTrainingStatus] = useState<"idle" | "saving" | "stored">("idle")
  const [memoryPulse, setMemoryPulse] = useState(false)
  const [holdActive, setHoldActive] = useState(false)
  const [radialIntent, setRadialIntent] = useState<{
    x: number
    y: number
  } | null>(null)
  const {
    currentTimelineAnchor,
    isInternalSeeking,
    completeInternalSeek,
    syncMediaPlayback,
    events,
    activeEventId,
    playback,
  } =
    useAxisChronologyStore(
      useShallow((state) => ({
        currentTimelineAnchor: state.currentTimelineAnchor,
        isInternalSeeking: state.isInternalSeeking,
        completeInternalSeek: state.completeInternalSeek,
        syncMediaPlayback: state.syncMediaPlayback,
        events: state.events,
        activeEventId: state.activeEventId,
        playback: state.playback,
      }))
    )

  const saveCurrentFrameToTrainingSet = async () => {
    const video = videoRef.current
    if (!video || !session.id || trainingStatus === "saving") return

    const frame = await captureVideoFrameBlob(video)
    if (!frame) return

    const sessionTime = Number(video.currentTime) || Number(playback.currentTimelineAnchor) || 0
    const activeEvent = activeEventId
      ? events.find((event) => event.id === activeEventId)
      : events.find((event) => Math.abs(Number(event.session_time) - sessionTime) <= 0.5)
    const basketballEvent =
      typeof activeEvent?.payload?.basketball_event === "string"
        ? activeEvent.payload.basketball_event
        : null
    const reconstructionChapter =
      typeof activeEvent?.payload?.reconstruction_chapter === "string"
        ? activeEvent.payload.reconstruction_chapter
        : null
    const motionState =
      activeEvent?.payload?.continuity_assist &&
      typeof activeEvent.payload.continuity_assist === "object"
        ? (activeEvent.payload.continuity_assist as Record<string, unknown>)
        : null
    const label = trainingLabelFromEvent(activeEvent)

    try {
      setTrainingStatus("saving")
      const formData = new FormData()
      formData.append("image", frame, `${session.id}-${sessionTime.toFixed(2)}.jpg`)
      formData.append("sessionId", session.id)
      formData.append("label", label)
      formData.append("replayTime", String(sessionTime))
      formData.append("videoUrl", session.playback_url || "")
      formData.append("clipStart", String(Math.max(0, sessionTime - 2)))
      formData.append("clipEnd", String(sessionTime + 2))
      formData.append("eventType", activeEvent?.type ? String(activeEvent.type) : "")
      formData.append(
        "metadata",
        JSON.stringify({
          selectedEventId: activeEventId,
          eventType: activeEvent?.type ? String(activeEvent.type) : null,
          basketballEvent,
          reconstructionChapter,
          opticalDepth: inspectionDepth,
          chronologyPosition: Number(playback.currentTimelineAnchor) || sessionTime,
          storagePath: session.storage_path,
          nearbyEvents: summarizeNearbyEvents(events, sessionTime),
          motionState,
        })
      )

      const response = await fetch("/api/training-memory", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("TRAINING_MEMORY_SAVE_FAILED")
      }
      const payload = (await response.json().catch(() => ({}))) as {
        memory?: TrainingMemoryRecord
      }

      if (payload.memory) onTrainingMemoryStored(payload.memory)
      setMemoryPulse(true)
      pulseHaptic([20, 34, 12])
      onRitualPractice()
      setTrainingStatus("stored")
      window.setTimeout(() => setMemoryPulse(false), 620)
      window.setTimeout(() => setTrainingStatus("idle"), 1900)
    } catch {
      setTrainingStatus("idle")
    }
  }

  const seekReplayToAnchor = useCallback(async (
    targetTime: number,
    eventId?: string | null,
    shouldResume = false
  ) => {
    const video = videoRef.current
    if (!video) return

    const seekVersion = seekVersionRef.current + 1
    seekVersionRef.current = seekVersion
    const duration = Number.isFinite(video.duration) ? video.duration : 0
    const clampedTarget = Math.min(Math.max(0, Number(targetTime) || 0), Math.max(duration, 0))
    const resumeAfterSeek = shouldResume || resumeAfterSeekRef.current || (!video.paused && !video.ended)
    resumeAfterSeekRef.current = resumeAfterSeek

    useAxisChronologyStore.getState().beginSeekTransaction(clampedTarget, eventId)

    if (!video.paused) video.pause()

    syncMediaPlayback({
      currentTime: clampedTarget,
      currentTimelineAnchor: clampedTarget,
      isPlaying: false,
      isSeeking: true,
      paused: true,
      readyState: video.readyState,
    })

    if (Math.abs(video.currentTime - clampedTarget) > 0.04) {
      video.currentTime = clampedTarget
      await waitForSeeked(video)
    }

    if (seekVersionRef.current !== seekVersion) return

    const settledTime = video.currentTime
    useAxisChronologyStore.getState().completeSeekTransaction(settledTime)
    syncMediaPlayback({
      currentTime: settledTime,
      currentTimelineAnchor: settledTime,
      isPlaying: false,
      isSeeking: false,
      paused: true,
      readyState: video.readyState,
    })

    if (resumeAfterSeek && !holdActive) {
      await video.play().catch(() => undefined)
      syncMediaPlayback({
        currentTime: video.currentTime,
        currentTimelineAnchor: video.currentTime,
        isPlaying: !video.paused,
        isSeeking: false,
        paused: video.paused,
        readyState: video.readyState,
      })
    }

    resumeAfterSeekRef.current = false
    const latestStore = useAxisChronologyStore.getState()
    if (latestStore.sessionId) {
      recordReplayNegotiation({
        sessionId: latestStore.sessionId,
        sessionTime: clampedTarget,
        type: "FREEZE_FRAME",
      })
    }
  }, [holdActive, syncMediaPlayback])

  const toggleReplayAwareness = () => {
    const video = videoRef.current
    if (!video) return

    if (useAxisChronologyStore.getState().playback.isSeeking) {
      resumeAfterSeekRef.current = true
      return
    }

    if (video.paused) {
      void video.play().catch(() => undefined)
    } else {
      video.pause()
    }
  }

  const openRadialIntent = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (radialTimerRef.current) window.clearTimeout(radialTimerRef.current)
    setRadialIntent({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })
    pulseHaptic(8)
    onRitualPractice()
    radialTimerRef.current = window.setTimeout(() => {
      radialTimerRef.current = null
      setRadialIntent(null)
    }, 1400)
  }

  const commitRitualIntent = (intent: RitualIntent) => {
    setRadialIntent(null)
    onRitualPractice()

    if (intent === "Mark" || intent === "Link") {
      void saveCurrentFrameToTrainingSet()
      return
    }

    if (intent === "Watch") {
      toggleReplayAwareness()
      return
    }

    if (intent === "Observe") {
      resumeAfterSeekRef.current = false
      videoRef.current?.pause()
      pulseHaptic(9)
      return
    }

    const state = useAxisChronologyStore.getState()
    if (state.activeEventId) {
      state.requestEventJump(state.activeEventId)
      pulseHaptic(7)
    }
  }

  const handleReplayTap = (event: MouseEvent<HTMLDivElement>) => {
    if (holdTriggeredRef.current) {
      holdTriggeredRef.current = false
      return
    }

    if (tapTimerRef.current) {
      window.clearTimeout(tapTimerRef.current)
      tapTimerRef.current = null
      openRadialIntent(event)
      return
    }

    tapTimerRef.current = window.setTimeout(() => {
      tapTimerRef.current = null
      toggleReplayAwareness()
      onRitualPractice()
    }, 220)
  }

  const startHoldObservation = () => {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)
    holdTriggeredRef.current = false
    holdTimerRef.current = window.setTimeout(() => {
      const video = videoRef.current
      holdTriggeredRef.current = true
      resumeAfterSeekRef.current = false
      setHoldActive(true)
      video?.pause()
      pulseHaptic(10)
      onRitualPractice()
    }, 520)
  }

  const endHoldObservation = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    setHoldActive(false)
  }

  useEffect(() => {
    if (!currentTimelineAnchor || !isInternalSeeking) return

    void seekReplayToAnchor(
      currentTimelineAnchor.targetTime,
      currentTimelineAnchor.eventId,
      resumeAfterSeekRef.current || (!videoRef.current?.paused && !videoRef.current?.ended)
    )
  }, [currentTimelineAnchor, isInternalSeeking, seekReplayToAnchor])

  useEffect(() => {
    const restoreFromChronology = () => {
      const state = useAxisChronologyStore.getState()
      if (!state.currentTimelineAnchor) return

      void seekReplayToAnchor(
        state.currentTimelineAnchor.targetTime,
        state.currentTimelineAnchor.eventId,
        !videoRef.current?.paused
      )
    }
    const handleVisibility = () => {
      if (document.visibilityState === "visible") restoreFromChronology()
    }

    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("pageshow", restoreFromChronology)
    window.addEventListener("focus", restoreFromChronology)
    window.addEventListener("pagehide", restoreFromChronology)
    window.addEventListener("blur", restoreFromChronology)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("pageshow", restoreFromChronology)
      window.removeEventListener("focus", restoreFromChronology)
      window.removeEventListener("pagehide", restoreFromChronology)
      window.removeEventListener("blur", restoreFromChronology)
    }
  }, [seekReplayToAnchor])

  useEffect(() => {
    const tick = () => {
      const video = videoRef.current
      const store = useAxisChronologyStore.getState()

      if (video && !video.paused && !store.playback.isSeeking) {
        syncMediaPlayback({
          currentTime: video.currentTime,
          currentTimelineAnchor: video.currentTime,
          paused: false,
          isPlaying: true,
          readyState: video.readyState,
        })
      }

      playbackClockFrameRef.current = window.requestAnimationFrame(tick)
    }

    playbackClockFrameRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (playbackClockFrameRef.current) {
        window.cancelAnimationFrame(playbackClockFrameRef.current)
      }
    }
  }, [syncMediaPlayback])

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current)
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)
      if (radialTimerRef.current) window.clearTimeout(radialTimerRef.current)
    }
  }, [])

  if (!playbackUrl) {
    return (
      <div className="aspect-video bg-[#050403]" />
    )
  }

  return (
    <div className="overflow-hidden bg-[#090706]">
      <div
        className={`relative overflow-hidden bg-[#050403] shadow-[0_42px_150px_rgba(0,0,0,0.82),0_0_120px_rgba(92,58,34,0.11)] transition duration-[140ms] ease-[cubic-bezier(0.2,0,0.18,1)] ${
          memoryPulse ? "shadow-[0_50px_170px_rgba(0,0,0,0.86),0_0_150px_rgba(215,192,138,0.16)]" : ""
        }`}
        onClick={handleReplayTap}
        onPointerDown={startHoldObservation}
        onPointerLeave={endHoldObservation}
        onPointerCancel={endHoldObservation}
        onPointerUp={endHoldObservation}
      >
        <div className="pointer-events-none absolute -inset-10 z-0 opacity-80">
          <div className="absolute inset-x-20 top-8 h-px bg-gradient-to-r from-transparent via-[#f2f1ed]/8 to-transparent" />
          <div className="absolute bottom-10 left-20 right-20 h-px bg-gradient-to-r from-transparent via-[#d7c08a]/12 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_62%,rgba(93,62,42,0.16),transparent_54%),radial-gradient(circle_at_82%_14%,rgba(78,64,112,0.08),transparent_42%)]" />
        </div>
        <video
          ref={videoRef}
          src={playbackUrl}
          playsInline
          preload="auto"
          onLoadedMetadata={(event) => {
            syncMediaPlayback({
              currentTime: event.currentTarget.currentTime,
              currentTimelineAnchor: event.currentTarget.currentTime,
              paused: event.currentTarget.paused,
              isPlaying: !event.currentTarget.paused,
              readyState: event.currentTarget.readyState,
            })
          }}
          onTimeUpdate={(event) => {
            if (useAxisChronologyStore.getState().playback.isSeeking) return

            syncMediaPlayback({
              currentTime: event.currentTarget.currentTime,
              paused: event.currentTarget.paused,
              isPlaying: !event.currentTarget.paused,
              readyState: event.currentTarget.readyState,
            })
          }}
          onPause={(event) => {
            syncMediaPlayback({
              currentTime: event.currentTarget.currentTime,
              currentTimelineAnchor: event.currentTarget.currentTime,
              isPlaying: false,
              paused: true,
              isSeeking: false,
              readyState: event.currentTarget.readyState,
            })
          }}
          onPlay={(event) => {
            syncMediaPlayback({
              currentTime: event.currentTarget.currentTime,
              currentTimelineAnchor: event.currentTarget.currentTime,
              isPlaying: true,
              paused: false,
              isSeeking: false,
              readyState: event.currentTarget.readyState,
            })
          }}
          onSeeking={(event) => {
            syncMediaPlayback({
              currentTime: event.currentTarget.currentTime,
              currentTimelineAnchor: event.currentTarget.currentTime,
              isPlaying: false,
              isSeeking: true,
              paused: true,
              readyState: event.currentTarget.readyState,
            })
          }}
          onSeeked={(event) => {
            useAxisChronologyStore.getState().completeSeekTransaction(event.currentTarget.currentTime)
            syncMediaPlayback({
              currentTime: event.currentTarget.currentTime,
              currentTimelineAnchor: event.currentTarget.currentTime,
              isPlaying: !event.currentTarget.paused,
              isSeeking: false,
              paused: event.currentTarget.paused,
              readyState: event.currentTarget.readyState,
            })
            completeInternalSeek()
          }}
          onCanPlay={(event) => {
            syncMediaPlayback({
              currentTime: event.currentTarget.currentTime,
              currentTimelineAnchor: event.currentTarget.currentTime,
              isPlaying: !event.currentTarget.paused,
              isSeeking: false,
              paused: event.currentTarget.paused,
              readyState: event.currentTarget.readyState,
            })
          }}
          className={`relative z-10 aspect-video w-full bg-black object-contain transition duration-[140ms] ease-[cubic-bezier(0.2,0,0.18,1)] ${
            memoryPulse ? "brightness-[1.12] contrast-[1.08]" : "brightness-[0.96]"
          }`}
          style={{
            transform: `scale(${inspectionDepth})`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle_at_50%_58%,rgba(242,241,237,0.05),transparent_34%),radial-gradient(circle_at_48%_100%,rgba(215,192,138,0.09),transparent_48%),linear-gradient(180deg,rgba(0,0,0,0.06),rgba(0,0,0,0.46))]" />
        {holdActive ? (
          <div className="pointer-events-none absolute inset-0 z-30 bg-[#0c0704]/34" />
        ) : null}
        <div className="axis-mono pointer-events-none absolute bottom-4 left-4 z-30 text-[10px] font-black uppercase tracking-[0.28em] text-white/38 drop-shadow-[0_0_8px_rgba(242,241,237,0.14)]">
          AXIS
        </div>
        {radialIntent ? (
          <RadialIntentField
            x={radialIntent.x}
            y={radialIntent.y}
            phase={ritualPhase}
            onCommit={commitRitualIntent}
          />
        ) : null}
        {memoryPulse ? (
          <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-[#d7c08a]/[0.045]">
            <div className="absolute inset-x-16 top-1/2 h-px bg-gradient-to-r from-transparent via-[#d7c08a]/30 to-transparent" />
            <div className="axis-mono bg-[#090706]/38 px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.22em] text-[#f2f1ed]/72 backdrop-blur">
              SAVED
            </div>
          </div>
        ) : null}
        <div className="absolute bottom-4 right-4 z-30 flex max-w-[min(20rem,calc(100%-2rem))] flex-col items-end gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              void saveCurrentFrameToTrainingSet()
            }}
            disabled={trainingStatus === "saving"}
            className={`axis-mono axis-optical-transition bg-black/28 px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/54 backdrop-blur transition hover:text-white/82 disabled:text-white/28 ${
              ritualPhase === "mastery"
                ? "opacity-0 hover:opacity-50"
                : ritualPhase === "practitioner"
                  ? "opacity-34 hover:opacity-80"
                  : "opacity-76"
            }`}
          >
            {trainingStatus === "stored" ? "MARKED" : "MARK"}
          </button>
        </div>
      </div>
    </div>
  )
}

function EventRail({ inspectionDepth }: { inspectionDepth: InspectionDepth }) {
  const { events, duration, activeEventId, requestEventJump, sessionId, playback } =
    useAxisChronologyStore(
      useShallow((state) => ({
        events: state.events,
        duration: state.duration,
        activeEventId: state.activeEventId,
        requestEventJump: state.requestEventJump,
        sessionId: state.sessionId,
        playback: state.playback,
      }))
    )
  const visibleEvents = events.filter((event) => event.type === "SNAPSHOT")
  const safeDuration = Math.max(duration, 1)
  const granularity = inspectionDepth === 0.5 ? 4 : inspectionDepth === 1 ? 8 : inspectionDepth === 2 ? 16 : 24
  const densityAnchors = visibleEvents.map((event) => ({
    time: Number(event.session_time) || 0,
    weight: event.id === activeEventId ? 1.45 : 1,
  }))
  const [dragging, setDragging] = useState(false)
  const lastDenseEventRef = useRef<string | null>(null)
  const suppressClickRef = useRef(false)
  const playheadPosition = Math.min(
    100,
    Math.max(0, (Number(playback.currentTimelineAnchor) / safeDuration) * 100)
  )
  const jumpToNearestAtPosition = (clientX: number, rail: HTMLDivElement) => {
    if (!visibleEvents.length) return

    const bounds = rail.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width))
    const targetTime = ratio * safeDuration
    const nearestEvent = visibleEvents.reduce((nearest, event) => {
      const nearestDistance = Math.abs(Number(nearest.session_time) - targetTime)
      const eventDistance = Math.abs(Number(event.session_time) - targetTime)
      return eventDistance < nearestDistance ? event : nearest
    }, visibleEvents[0])

    if (lastDenseEventRef.current !== nearestEvent.id) {
      requestEventJump(nearestEvent.id)
      lastDenseEventRef.current = nearestEvent.id
      pulseHaptic(hapticForDensity(memoryDensityAt(targetTime, densityAnchors, safeDuration)))
      if (sessionId) {
        recordReplayNegotiation({
          sessionId,
          sessionTime: Number(nearestEvent.session_time) || 0,
          type: "RAIL_JUMP",
        })
      }
    }
  }

  return (
    <div className="mt-8 px-1 py-3">
      <div
        className={`relative h-10 touch-none transition-opacity duration-150 ${
          dragging ? "opacity-100" : "opacity-78"
        }`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          suppressClickRef.current = true
          setDragging(true)
          jumpToNearestAtPosition(event.clientX, event.currentTarget)
        }}
        onPointerMove={(event) => {
          if (!dragging) return
          jumpToNearestAtPosition(event.clientX, event.currentTarget)
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId)
          setDragging(false)
          lastDenseEventRef.current = null
          window.setTimeout(() => {
            suppressClickRef.current = false
          }, 0)
        }}
        onPointerCancel={() => {
          setDragging(false)
          lastDenseEventRef.current = null
          suppressClickRef.current = false
        }}
        onClick={(event) => {
          if (suppressClickRef.current) return
          jumpToNearestAtPosition(event.clientX, event.currentTarget)
        }}
      >
        <div className="absolute left-0 right-0 top-1/2 h-5 -translate-y-1/2 overflow-hidden">
          {densityAnchors.map((anchor) => {
            const position = Math.min(100, Math.max(0, (anchor.time / safeDuration) * 100))
            const density = memoryDensityAt(anchor.time, densityAnchors, safeDuration)
            const width = Math.min(18, 5 + density * 4)

            return (
              <span
                key={`pressure-${anchor.time}`}
                className="absolute top-1/2 h-5 -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(215,192,138,0.16),transparent_68%)]"
                style={{
                  left: `${position}%`,
                  width: `${width}%`,
                }}
              />
            )
          })}
        </div>
        {Array.from({
          length: granularity + 1,
        }).map((_, index) => (
          <span
            key={index}
            className="absolute top-1/2 h-2 -translate-y-1/2 border-l border-white/[0.035]"
            style={{
              left: `${(index / granularity) * 100}%`,
            }}
          />
        ))}
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-white/[0.035] via-[#f2f1ed]/16 to-white/[0.035]" />
        <span
          className="pointer-events-none absolute top-1/2 h-7 w-px -translate-y-1/2 bg-[#f2f1ed]/42 shadow-[0_0_18px_rgba(242,241,237,0.2)]"
          style={{
            left: `${playheadPosition}%`,
          }}
        />
        {visibleEvents.map((event) => {
          const position = Math.min(
            100,
            Math.max(0, (Number(event.session_time) / safeDuration) * 100)
          )
          const active = event.id === activeEventId

          return (
            <button
              key={event.id}
              type="button"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation()
                requestEventJump(event.id)
                pulseHaptic(hapticForDensity(memoryDensityAt(Number(event.session_time) || 0, densityAnchors, safeDuration)))
                if (sessionId) {
                  recordReplayNegotiation({
                    sessionId,
                    sessionTime: Number(event.session_time) || 0,
                    type: "EVENT_JUMP",
                  })
                }
              }}
              aria-label={`Back to ${formatClock(event.session_time)}`}
              className={`axis-optical-transition absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-[0] transition ${
                active
                  ? "bg-[#f2f1ed] shadow-[0_0_18px_rgba(215,192,138,0.24)]"
                  : "bg-[#d7c08a]/26 hover:bg-[#f2f1ed]"
              }`}
              style={{
                left: `${position}%`,
              }}
            />
          )
        })}
      </div>
      <div className="axis-mono mt-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-700">
        <span>00:00</span>
        <span className="text-zinc-700">{inspectionDepth}X</span>
        <span>{formatClock(duration)}</span>
      </div>
    </div>
  )
}

function InspectionDepthControl({
  inspectionDepth,
  setInspectionDepth,
}: {
  inspectionDepth: InspectionDepth
  setInspectionDepth: (depth: InspectionDepth) => void
}) {
  return (
    <div className="mt-3 flex justify-center">
      <div className="grid grid-cols-4 bg-white/[0.01]">
        {inspectionDepths.map((depth) => {
          const active = depth === inspectionDepth

          return (
            <button
              key={depth}
              type="button"
              onClick={() => setInspectionDepth(depth)}
              className={`axis-mono axis-optical-transition h-8 min-w-12 px-3 text-[10px] font-semibold transition ${
                active
                  ? "bg-[#f2f1ed]/88 text-black"
                  : "bg-transparent text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300"
              }`}
            >
              {depth}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ChronologyEdge({
  trainingMemories,
}: {
  trainingMemories: TrainingMemoryRecord[]
}) {
  const { events, duration, requestEventJump } = useAxisChronologyStore(
    useShallow((state) => ({
      events: state.events,
      duration: state.duration,
      requestEventJump: state.requestEventJump,
    }))
  )
  const safeDuration = Math.max(Number(duration) || 0, 1)
  const anchors = events
    .filter((event) => event.type === "SNAPSHOT")
    .slice(0, 18)
    .map((event) => ({
      id: event.id,
      time: Number(event.session_time) || 0,
      weight: 0.45,
      type: "event" as const,
    }))
  const memories = trainingMemories.slice(0, 12).map((memory) => ({
    id: memory.id,
    time: Number(memory.replay_time) || 0,
    weight: 0.82,
    type: "memory" as const,
  }))
  const nodes = [...anchors, ...memories].sort((a, b) => a.time - b.time)
  const pressureZones = nodes
    .map((node) => ({
      ...node,
      density: memoryDensityAt(node.time, nodes, safeDuration),
    }))
    .filter((node) => node.density >= 1.1)

  return (
    <div className="pointer-events-none fixed inset-y-0 right-0 z-10 hidden w-12 md:block">
      <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#2f1d13]/18 to-transparent" />
      <div className="absolute inset-y-16 right-6 w-px bg-gradient-to-b from-transparent via-[#d7c08a]/10 to-transparent" />
      {pressureZones.map((zone) => {
        const top = Math.min(92, Math.max(8, (zone.time / safeDuration) * 84 + 8))
        const height = Math.min(96, 24 + zone.density * 18)

        return (
          <span
            key={`zone-${zone.type}-${zone.id}`}
            className="absolute right-0 w-12 -translate-y-1/2 bg-[radial-gradient(ellipse_at_right,rgba(215,192,138,0.13),transparent_70%)]"
            style={{
              top: `${top}%`,
              height,
              opacity: Math.min(0.8, 0.2 + zone.density * 0.12),
            }}
          />
        )
      })}
      {nodes.map((node) => {
        const top = Math.min(92, Math.max(8, (node.time / safeDuration) * 84 + 8))
        const height = node.type === "memory" ? 22 : 10
        const density = memoryDensityAt(node.time, nodes, safeDuration)

        return (
          <button
            key={`${node.type}-${node.id}`}
            type="button"
            aria-label={`Back to ${formatClock(node.time)}`}
            onClick={() => {
              if (node.type === "event") {
                requestEventJump(node.id)
              } else {
                const nearest = anchors.reduce<typeof anchors[number] | null>((selected, anchor) => {
                  if (!selected) return anchor

                  return Math.abs(anchor.time - node.time) < Math.abs(selected.time - node.time)
                    ? anchor
                    : selected
                }, null)

                if (nearest) requestEventJump(nearest.id)
              }
              pulseHaptic(hapticForDensity(density))
            }}
            className="pointer-events-auto absolute right-5 w-1 -translate-y-1/2 bg-[#f2f1ed]/25 transition hover:bg-[#f2f1ed]/70"
            style={{
              top: `${top}%`,
              height: height + Math.min(12, density * 3),
              opacity: node.weight,
              boxShadow:
                node.type === "memory"
                  ? "0 0 22px rgba(215,192,138,0.2)"
                  : "0 0 10px rgba(242,241,237,0.08)",
            }}
          />
        )
      })}
    </div>
  )
}

function exportLabel(status: string) {
  if (status === "SUCCESS") return "SAVED"
  return "SAVE TO DEVICE"
}

function DeviceExportControl({ session }: { session: TemporalSessionRecord }) {
  const { exportStatus, exportProgress, executeNativeExport, playback } = useAxisChronologyStore(
    useShallow((state) => ({
      exportStatus: state.exportStatus,
      exportProgress: state.exportProgress,
      executeNativeExport: state.executeNativeExport,
      playback: state.playback,
    }))
  )
  const isWorking = exportStatus === "DOWNLOADING" || exportStatus === "PREPARING_TRANSFER"
  const canExport = Boolean(session.playback_url) && !isWorking

  if (!session.playback_url) return null

  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <button
        type="button"
        disabled={!canExport}
        onClick={() => {
          if (!session.playback_url) return
          recordReplayNegotiation({
            sessionId: session.id,
            sessionTime: Number(playback.currentTimelineAnchor) || 0,
            type: "EXPORT",
          })
          void executeNativeExport(session.playback_url, `axis-record-${session.id}`)
        }}
        className="axis-mono axis-optical-transition bg-[#f2f1ed]/92 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-black transition disabled:cursor-wait disabled:bg-white/10 disabled:text-zinc-500"
      >
        SAVE TO DEVICE
      </button>
      {exportStatus !== "IDLE" && exportStatus !== "FAILED" ? (
        <p className="axis-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
          {exportStatus === "SUCCESS" ? exportLabel(exportStatus) : `${exportProgress}%`}
        </p>
      ) : null}
    </div>
  )
}

function DevelopmentalInputBar({
  trainingMemories,
}: {
  trainingMemories: TrainingMemoryRecord[]
}) {
  const { events, snapshots, requestEventJump, sessionId } = useAxisChronologyStore(
    useShallow((state) => ({
      events: state.events,
      snapshots: state.snapshots,
      requestEventJump: state.requestEventJump,
      sessionId: state.sessionId,
    }))
  )
  const [query, setQuery] = useState("")
  const [response, setResponse] = useState("")

  const submitQuery = () => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return

    const basketballMatches = events.filter((event) => {
      const payloadText = JSON.stringify(event.payload || {}).toLowerCase()
      return payloadText.includes(normalized) || String(event.type).toLowerCase().includes(normalized)
    })
    const hesitationMatches = normalized.includes("hesitation")
      ? trainingMemories.filter((memory) =>
          memoryProgressionContext(memory).toLowerCase().includes("drive")
        )
      : []
    const recoveryMatches = normalized.includes("recover")
      ? trainingMemories.filter((memory) =>
          memoryProgressionContext(memory).toLowerCase().includes("recover")
        )
      : []
    const rhythmMatches =
      normalized.includes("rhythm") || normalized.includes("continuity")
        ? [...snapshots].slice(0, 6)
        : []
    const relatedCount = Math.max(
      basketballMatches.length,
      hesitationMatches.length,
      recoveryMatches.length,
      rhythmMatches.length,
      trainingMemories.length ? 1 : 0
    )

    const targetEvent =
      basketballMatches[0] ||
      (rhythmMatches[0]
        ? events.find(
            (event) =>
              event.type === "SNAPSHOT" &&
              Math.abs(Number(event.session_time) - Number(rhythmMatches[0].session_time)) <= 0.5
          )
        : null)

    if (targetEvent) {
      requestEventJump(targetEvent.id)
      if (sessionId) {
        recordReplayNegotiation({
          sessionId,
          sessionTime: Number(targetEvent.session_time) || 0,
          type: "LANGUAGE_ROUTE",
        })
      }
    }

    if (normalized.includes("compare")) {
      setResponse(`${Math.max(trainingMemories.length, snapshots.length)} linked.`)
    } else if (normalized.includes("pressure")) {
      setResponse(`${relatedCount} to watch again.`)
    } else if (normalized.includes("recover")) {
      setResponse(`${relatedCount} found.`)
    } else if (normalized.includes("rhythm") || normalized.includes("continuity")) {
      setResponse(`${relatedCount} to watch again.`)
    } else {
      setResponse(`${relatedCount} to watch again.`)
    }
  }

  return (
    <section className="mx-auto mt-12 w-full max-w-4xl px-2 pb-2">
      <form
        className="flex flex-col gap-3 rounded-none bg-[radial-gradient(ellipse_at_center,rgba(215,192,138,0.045),transparent_72%)] py-2 md:flex-row md:items-center"
        onSubmit={(event) => {
          event.preventDefault()
          submitQuery()
        }}
      >
        <label className="sr-only">Ask</label>
        <input
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="watch that again"
          className="axis-mono min-h-12 flex-1 border-0 border-b border-[#d7c08a]/10 bg-transparent px-1 py-2 text-center text-[14px] text-[#f2f1ed] outline-none placeholder:text-[#8c7b66]/42 focus:border-[#d7c08a]/34 md:text-left"
        />
        <button
          type="submit"
          className="axis-mono axis-optical-transition self-center bg-[#d7c08a]/[0.035] px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-[#f2f1ed]/44 transition hover:bg-[#f2f1ed]/86 hover:text-black md:self-auto"
        >
          observe
        </button>
      </form>
      {response ? (
        <p className="axis-mono mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d7c08a]/34 md:text-left">
          {response}
        </p>
      ) : null}
    </section>
  )
}

function DevelopmentalMemoryStrip({
  trainingMemories,
}: {
  trainingMemories: TrainingMemoryRecord[]
}) {
  const { snapshots, requestEventJump, events, updateSnapshotAnnotation, sessionId } =
    useAxisChronologyStore(
      useShallow((state) => ({
        snapshots: state.snapshots,
        requestEventJump: state.requestEventJump,
        events: state.events,
        updateSnapshotAnnotation: state.updateSnapshotAnnotation,
        sessionId: state.sessionId,
      }))
    )

  if (!snapshots.length && !trainingMemories.length) return null

  const jumpToMoment = (sessionTime: number, snapshotId?: string | null) => {
    const snapshotEvent = events.find(
      (event) =>
        event.type === "SNAPSHOT" &&
        (snapshotId
          ? event.payload?.snapshot_id === snapshotId
          : Math.abs(Number(event.session_time) - Number(sessionTime)) <= 0.5)
    )

    if (snapshotEvent) requestEventJump(snapshotEvent.id)
    if (sessionId) {
      recordReplayNegotiation({
        sessionId,
        sessionTime: Number(sessionTime) || 0,
        type: "SNAPSHOT_JUMP",
      })
    }
  }

  const chapterForSnapshot = (snapshot: AxisSnapshot): BasketballReconstructionChapter | null => {
    const basketballEvent = events.find((event) => {
      if (event.type !== "BASKETBALL_EVENT") return false

      return (
        event.payload?.snapshot_id === snapshot.id ||
        Math.abs(Number(event.session_time) - Number(snapshot.session_time)) < 0.01
      )
    })
    const event = basketballEvent?.payload?.basketball_event
    const chapter = basketballEvent?.payload?.reconstruction_chapter

    if (typeof chapter === "string") return chapter as BasketballReconstructionChapter

    return typeof event === "string" && basketballEvents.includes(event as BasketballEvent)
      ? reconstructionChapterForEvent(event as BasketballEvent)
      : null
  }

  return (
    <section className="mt-14">
      <div className="mb-3 flex justify-end">
        <Link
          href="/training-set"
          className="axis-mono text-[9px] font-black uppercase tracking-[0.16em] text-white/28 transition hover:text-white/66"
        >
          Saved
        </Link>
      </div>
      <div className="relative overflow-hidden px-1 py-2">
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-[#d7c08a]/10 to-transparent" />
        <div className="relative flex gap-2 overflow-x-auto pb-1">
          {trainingMemories.map((memory, index) => {
            const progressionContext = memoryProgressionContext(memory)

            return (
              <button
                key={memory.id}
                type="button"
                onClick={() => jumpToMoment(Number(memory.replay_time))}
                className="axis-optical-transition group relative min-w-44 overflow-hidden bg-[#090706]/38 text-left transition hover:bg-[#d7c08a]/[0.035]"
              >
                <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.54))]" />
                <div className="pointer-events-none absolute left-3 top-3 z-20 axis-mono text-[8px] font-black uppercase tracking-[0.14em] text-white/46">
                  SAVED {String(index + 1).padStart(2, "0")}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={memory.frame_url}
                  alt={`${memory.label} saved at ${formatClock(memory.replay_time)}`}
                  className="aspect-video w-44 object-cover grayscale-[16%] opacity-82 transition duration-150 group-hover:brightness-110 group-hover:opacity-100"
                />
                <div className="relative z-20 space-y-2 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="axis-mono text-[10px] font-black uppercase tracking-[0.14em] text-[#f2f1ed]/82">
                      {memory.label}
                    </p>
                    <p className="axis-mono text-[9px] font-black text-[#d7c08a]/72">
                      {formatClock(memory.replay_time)}
                    </p>
                  </div>
                  <p className="axis-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-[#8c7b66]/54">
                    {progressionContext}
                  </p>
                </div>
              </button>
            )
          })}
        {snapshots.map((snapshot) => {
          const source = snapshot.image_url || snapshot.localUrl
          const chapter = chapterForSnapshot(snapshot)

          return (
            <div
              key={snapshot.id}
              className="min-w-32 bg-[#090706]/30"
            >
              <button
                type="button"
                onClick={() => jumpToMoment(Number(snapshot.session_time), snapshot.id)}
                className="axis-optical-transition block text-left transition active:bg-white/10"
              >
                {source ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={source}
                    alt={`Marked at ${formatClock(snapshot.session_time)}`}
                    className="aspect-video w-32 object-cover grayscale-[32%] opacity-72"
                  />
                ) : (
                  <div className="grid aspect-video w-32 place-items-center bg-zinc-950 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-700">
                    SNAP
                  </div>
                )}
              </button>
              <div className="px-2 py-2">
                <p className="axis-mono text-[10px] font-bold text-zinc-400">
                  {formatClock(snapshot.session_time)}
                </p>
                {chapter ? (
                  <p className="axis-mono mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#d7c08a]/50">
                    {chapter}
                  </p>
                ) : null}
                <input
                  type="text"
                  value={snapshot.annotation}
                  onChange={(event) =>
                    updateSnapshotAnnotation(snapshot.id, event.currentTarget.value)
                  }
                  onBlur={() => {
                    if (!sessionId || !snapshot.annotation.trim()) return
                    recordReplayNegotiation({
                      sessionId,
                      sessionTime: Number(snapshot.session_time) || 0,
                      type: "ANNOTATION",
                    })
                  }}
                  placeholder="note"
                  maxLength={120}
                  aria-label={`Snapshot note at ${formatClock(snapshot.session_time)}`}
                  className="axis-mono axis-optical-transition mt-2 w-full border-0 border-b border-[#d7c08a]/10 bg-transparent px-0 py-1 text-[11px] font-semibold lowercase text-zinc-200 outline-none transition placeholder:text-[#8c7b66]/44 focus:border-[#d7c08a]/60"
                />
              </div>
            </div>
          )
        })}
        </div>
      </div>
    </section>
  )
}

export function SessionReplayCanvas({ session }: { session: TemporalSessionRecord }) {
  const [inspectionDepth, setInspectionDepth] = useState<InspectionDepth>(1)
  const [trainingMemories, setTrainingMemories] = useState<TrainingMemoryRecord[]>([])
  const [ritualPhase, setRitualPhase] = useState<RitualPhase>("apprentice")
  const { hydrateChronology, hydrateSnapshots, setUiStatus } = useAxisChronologyStore(
    useShallow((state) => ({
      hydrateChronology: state.hydrateChronology,
      hydrateSnapshots: state.hydrateSnapshots,
      setUiStatus: state.setUiStatus,
    }))
  )

  useEffect(() => {
    hydrateChronology({
      sessionId: session.id,
      duration: Number(session.duration_seconds) || 0,
      events: [],
    })
    setUiStatus("loading")
  }, [hydrateChronology, session.duration_seconds, session.id, setUiStatus])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setRitualPhase(readRitualPhase())
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  const markRitual = () => {
    setRitualPhase(markRitualPractice())
  }

  useEffect(() => {
    let active = true

    async function loadEvents() {
      try {
        const response = await fetch(`/api/live/session/${session.id}`, {
          cache: "no-store",
        })
        const payload = (await response.json().catch(() => ({}))) as SessionPayload

        if (!active) return
        hydrateChronology({
          sessionId: session.id,
          duration: Number(session.duration_seconds) || 0,
          events: payload.events || [],
        })
        hydrateSnapshots(payload.snapshots || [])
        setTrainingMemories(payload.trainingMemories || [])
      } finally {
        return
      }
    }

    void loadEvents()

    return () => {
      active = false
    }
  }, [hydrateChronology, hydrateSnapshots, session.duration_seconds, session.id])

  return (
    <main className="axis-display min-h-dvh overflow-hidden bg-[#090706] text-[#f2f1ed]">
      <section className="pointer-events-none fixed inset-0 opacity-85">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_6%,rgba(215,192,138,0.095),transparent_46%),radial-gradient(circle_at_12%_92%,rgba(84,63,94,0.11),transparent_42%),radial-gradient(circle_at_88%_78%,rgba(83,47,27,0.13),transparent_44%)]" />
        <div className="absolute inset-x-0 top-0 h-80 bg-[linear-gradient(180deg,rgba(16,10,6,0.72),transparent)]" />
        <div className="absolute bottom-0 left-0 right-0 h-96 bg-[linear-gradient(180deg,transparent,rgba(5,3,2,0.9))]" />
      </section>
      <ChronologyEdge trainingMemories={trainingMemories} />
      <section className="relative mx-auto flex min-h-dvh w-full max-w-[92rem] flex-col px-4 py-6 sm:px-8">
        <header className="py-3">
          <div className="flex items-center justify-between gap-6">
            <Link
              href="/live"
              className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#f2f1ed]"
            >
              AXIS
            </Link>
            <p className="axis-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              {session.status === "ARCHIVED" ? "SAVED" : "WAIT"}
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-4 py-12 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="axis-mono text-sm font-semibold uppercase tracking-[0.18em] text-[#f2f1ed]/70">
              {compactNodeId(session.id)}
            </p>
            <p className="mt-2 text-6xl font-bold leading-none tracking-normal text-[#f2f1ed] sm:text-7xl">
              {formatPreciseClock(session.duration_seconds)}
            </p>
            <p className="axis-mono mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8c7b66]/64">
              {formatEnvironmentalTimestamp(session.created_at)}
            </p>
          </div>
          <DeviceExportControl session={session} />
        </div>

        <div className="grid flex-1 gap-5 py-4">
          <section className="min-w-0">
            <ReplayVideo
              playbackUrl={session.playback_url}
              inspectionDepth={inspectionDepth}
              session={session}
              ritualPhase={ritualPhase}
              onRitualPractice={markRitual}
              onTrainingMemoryStored={(memory) =>
                setTrainingMemories((current) => {
                  if (current.some((item) => item.id === memory.id)) return current
                  return [...current, memory].sort(
                    (a, b) => Number(a.replay_time) - Number(b.replay_time)
                  )
                })
              }
            />
            <InspectionDepthControl
              inspectionDepth={inspectionDepth}
              setInspectionDepth={setInspectionDepth}
            />
            <EventRail inspectionDepth={inspectionDepth} />
            <DevelopmentalInputBar trainingMemories={trainingMemories} />
            <DevelopmentalMemoryStrip trainingMemories={trainingMemories} />
          </section>
        </div>
      </section>
    </main>
  )
}
