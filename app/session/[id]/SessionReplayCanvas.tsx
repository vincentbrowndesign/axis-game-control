"use client"

import { useEffect, useRef, useState } from "react"
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

const inspectionDepths: InspectionDepth[] = [0.5, 1, 2, 2.5]

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

  return "OBSERVATION"
}

function trainingLabelFromEvent(event: TemporalEventRecord | undefined) {
  const basketballEvent = event?.payload?.basketball_event

  if (basketballEvent === "MAKE") return "make"
  if (basketballEvent === "MISS") return "miss"
  if (basketballEvent === "SHOT") return "release"

  return "other"
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

async function syncSeekToAnchor(
  targetTime: number,
  videoElement: HTMLVideoElement | null,
  eventId?: string | null
) {
  if (!videoElement) return

  const store = useAxisChronologyStore.getState()
  if (store.playback.isSeeking) return

  const duration = Number.isFinite(videoElement.duration) ? videoElement.duration : 0
  const clampedTarget = Math.min(Math.max(0, Number(targetTime) || 0), Math.max(duration, 0))

  store.beginSeekTransaction(clampedTarget, eventId)
  videoElement.pause()

  if (Math.abs(videoElement.currentTime - clampedTarget) > 0.04) {
    videoElement.currentTime = clampedTarget
    await waitForSeeked(videoElement)
  }

  videoElement.pause()
  useAxisChronologyStore.getState().completeSeekTransaction(videoElement.currentTime)
  const latestStore = useAxisChronologyStore.getState()
  if (latestStore.sessionId) {
    recordReplayNegotiation({
      sessionId: latestStore.sessionId,
      sessionTime: clampedTarget,
      type: "FREEZE_FRAME",
    })
  }
}

function ReplayVideo({
  playbackUrl,
  inspectionDepth,
  session,
  onTrainingMemoryStored,
}: {
  playbackUrl: string | null
  inspectionDepth: InspectionDepth
  session: TemporalSessionRecord
  onTrainingMemoryStored: (memory: TrainingMemoryRecord) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [trainingStatus, setTrainingStatus] = useState<"idle" | "saving" | "stored">("idle")
  const [memoryPulse, setMemoryPulse] = useState(false)
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
      setTrainingStatus("stored")
      window.setTimeout(() => setMemoryPulse(false), 620)
      window.setTimeout(() => setTrainingStatus("idle"), 1900)
    } catch {
      setTrainingStatus("idle")
    }
  }

  useEffect(() => {
    if (!currentTimelineAnchor || !isInternalSeeking) return

    void syncSeekToAnchor(
      currentTimelineAnchor.targetTime,
      videoRef.current,
      currentTimelineAnchor.eventId
    )
  }, [currentTimelineAnchor, isInternalSeeking])

  useEffect(() => {
    const restoreFromChronology = () => {
      const state = useAxisChronologyStore.getState()
      if (!state.currentTimelineAnchor) return

      void syncSeekToAnchor(
        state.currentTimelineAnchor.targetTime,
        videoRef.current,
        state.currentTimelineAnchor.eventId
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
  }, [])

  if (!playbackUrl) {
    return (
      <div className="grid aspect-video place-items-center border border-white/10 bg-[#070707] text-center">
        <p className="axis-mono text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500">
          RECORD PROCESSING
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden bg-[#050505]">
      <div className="relative overflow-hidden bg-[#020202] shadow-[0_40px_140px_rgba(0,0,0,0.8)]">
        <div className="pointer-events-none absolute -inset-10 z-0 opacity-70">
          <div className="absolute inset-x-20 top-8 h-px bg-gradient-to-r from-transparent via-[#f2f1ed]/8 to-transparent" />
          <div className="absolute bottom-10 left-20 right-20 h-px bg-gradient-to-r from-transparent via-[#d7c08a]/8 to-transparent" />
        </div>
        <video
          ref={videoRef}
          src={playbackUrl}
          controls
          playsInline
          preload="metadata"
          onLoadedMetadata={(event) => {
            syncMediaPlayback({
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
              isPlaying: false,
              paused: true,
              readyState: event.currentTarget.readyState,
            })
          }}
          onPlay={(event) => {
            if (useAxisChronologyStore.getState().playback.isSeeking) {
              event.currentTarget.pause()
              return
            }

            syncMediaPlayback({
              currentTime: event.currentTarget.currentTime,
              isPlaying: true,
              paused: false,
              readyState: event.currentTarget.readyState,
            })
          }}
          onSeeked={(event) => {
            if (useAxisChronologyStore.getState().playback.isSeeking) return

            syncMediaPlayback({
              currentTime: event.currentTarget.currentTime,
              isPlaying: !event.currentTarget.paused,
              paused: event.currentTarget.paused,
              readyState: event.currentTarget.readyState,
            })
            completeInternalSeek()
          }}
          className={`relative z-10 aspect-video w-full bg-black object-contain transition duration-[140ms] ease-[cubic-bezier(0.2,0,0.18,1)] ${
            memoryPulse ? "brightness-[1.12] contrast-[1.08]" : "brightness-[0.96]"
          }`}
          style={{
            transform: `scale(${inspectionDepth})`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle_at_50%_58%,rgba(242,241,237,0.055),transparent_36%),linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.44))]" />
        <div className="axis-mono pointer-events-none absolute bottom-4 left-4 z-30 text-[10px] font-black uppercase tracking-[0.28em] text-white/38 drop-shadow-[0_0_8px_rgba(242,241,237,0.14)]">
          AXIS
        </div>
        {memoryPulse ? (
          <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-[#f2f1ed]/[0.035]">
            <div className="axis-mono bg-black/22 px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.22em] text-[#f2f1ed]/70 backdrop-blur">
              MEMORY STORED
            </div>
          </div>
        ) : null}
        <div className="absolute bottom-4 right-4 z-30 flex max-w-[min(20rem,calc(100%-2rem))] flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => void saveCurrentFrameToTrainingSet()}
            disabled={trainingStatus === "saving"}
            className="axis-mono axis-optical-transition bg-black/28 px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/54 backdrop-blur transition hover:text-white/82 disabled:text-white/28"
          >
            {trainingStatus === "stored" ? "TRAINING MEMORY STORED" : "SAVE TO TRAINING SET"}
          </button>
        </div>
      </div>
    </div>
  )
}

function EventRail({ inspectionDepth }: { inspectionDepth: InspectionDepth }) {
  const { events, duration, activeEventId, requestEventJump, sessionId } =
    useAxisChronologyStore(
      useShallow((state) => ({
        events: state.events,
        duration: state.duration,
        activeEventId: state.activeEventId,
        requestEventJump: state.requestEventJump,
        sessionId: state.sessionId,
      }))
    )
  const visibleEvents = events.filter((event) => event.type === "SNAPSHOT")
  const safeDuration = Math.max(duration, 1)
  const granularity = inspectionDepth === 0.5 ? 4 : inspectionDepth === 1 ? 8 : inspectionDepth === 2 ? 16 : 24
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

    requestEventJump(nearestEvent.id)
    if (sessionId) {
      recordReplayNegotiation({
        sessionId,
        sessionTime: Number(nearestEvent.session_time) || 0,
        type: "RAIL_JUMP",
      })
    }
  }

  return (
    <div className="mt-8 px-1 py-3">
      <div
        className="relative h-10"
        onClick={(event) => {
          jumpToNearestAtPosition(event.clientX, event.currentTarget)
        }}
      >
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
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/12" />
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
                if (sessionId) {
                  recordReplayNegotiation({
                    sessionId,
                    sessionTime: Number(event.session_time) || 0,
                    type: "EVENT_JUMP",
                  })
                }
              }}
              aria-label={`Jump to snapshot at ${formatClock(event.session_time)}`}
              className={`axis-optical-transition absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-[0] transition ${
                active
                  ? "bg-[#f2f1ed] shadow-[0_0_14px_rgba(242,241,237,0.18)]"
                  : "bg-zinc-300/28 hover:bg-[#f2f1ed]"
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

function exportLabel(status: string) {
  if (status === "SUCCESS") return "FILE READY"
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
      setResponse(`${Math.max(trainingMemories.length, snapshots.length)} comparable memory fragments linked.`)
    } else if (normalized.includes("pressure")) {
      setResponse(`${relatedCount} pressure-adjacent replay moments surfaced.`)
    } else if (normalized.includes("recover")) {
      setResponse(`${relatedCount} recovery sequences found.`)
    } else if (normalized.includes("rhythm") || normalized.includes("continuity")) {
      setResponse(`${relatedCount} continuity moments ready for review.`)
    } else {
      setResponse(`${relatedCount} related replay sequences found.`)
    }
  }

  return (
    <section className="mx-auto mt-10 w-full max-w-4xl px-2 pb-2">
      <form
        className="flex flex-col gap-3 md:flex-row md:items-center"
        onSubmit={(event) => {
          event.preventDefault()
          submitQuery()
        }}
      >
        <label className="sr-only">Ask memory</label>
        <input
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="show me where rhythm shifted"
          className="axis-mono min-h-12 flex-1 border-0 border-b border-white/10 bg-transparent px-1 py-2 text-center text-[14px] text-[#f2f1ed] outline-none placeholder:text-zinc-700 focus:border-[#d7c08a]/34 md:text-left"
        />
        <button
          type="submit"
          className="axis-mono axis-optical-transition self-center bg-white/[0.025] px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-white/42 transition hover:bg-[#f2f1ed]/86 hover:text-black md:self-auto"
        >
          ask
        </button>
      </form>
      {response ? (
        <p className="axis-mono mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d7c08a]/38 md:text-left">
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
          Training set
        </Link>
      </div>
      <div className="relative overflow-hidden px-1 py-2">
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-white/[0.035]" />
        <div className="relative flex gap-2 overflow-x-auto pb-1">
          {trainingMemories.map((memory, index) => {
            const progressionContext = memoryProgressionContext(memory)

            return (
              <button
                key={memory.id}
                type="button"
                onClick={() => jumpToMoment(Number(memory.replay_time))}
                className="axis-optical-transition group relative min-w-44 overflow-hidden bg-black/32 text-left transition hover:bg-white/[0.03]"
              >
                <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.54))]" />
                <div className="pointer-events-none absolute left-3 top-3 z-20 axis-mono text-[8px] font-black uppercase tracking-[0.14em] text-white/46">
                  MEMORY {String(index + 1).padStart(2, "0")}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={memory.frame_url}
                  alt={`${memory.label} memory at ${formatClock(memory.replay_time)}`}
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
                  <p className="axis-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-zinc-700">
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
              className="min-w-32 bg-black/24"
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
                    alt={`Snapshot at ${formatClock(snapshot.session_time)}`}
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
                  <p className="axis-mono mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#d7c08a]/54">
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
                  className="axis-mono axis-optical-transition mt-2 w-full border-0 border-b border-white/10 bg-transparent px-0 py-1 text-[11px] font-semibold lowercase text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-[#d7c08a]/60"
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
    <main className="axis-display min-h-dvh overflow-hidden bg-[#030303] text-[#f2f1ed]">
      <section className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_50%_0%,rgba(215,192,138,0.07),transparent_58%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-80 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.84))]" />
      </section>
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
              {session.status === "ARCHIVED" ? "ARCHIVED" : "LOCKED"}
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-4 py-12 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="axis-mono text-sm font-semibold uppercase tracking-[0.18em] text-zinc-300">
              {compactNodeId(session.id)}
            </p>
            <p className="mt-2 text-6xl font-bold leading-none tracking-normal text-[#f2f1ed] sm:text-7xl">
              {formatPreciseClock(session.duration_seconds)}
            </p>
            <p className="axis-mono mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
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
