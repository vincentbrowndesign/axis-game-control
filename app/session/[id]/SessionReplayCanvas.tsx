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
import type {
  TemporalEventRecord,
  TemporalSessionRecord,
  TemporalSnapshotRecord,
} from "@/lib/temporalEventGraph"

type SessionPayload = {
  ok?: boolean
  events?: TemporalEventRecord[]
  snapshots?: TemporalSnapshotRecord[]
}

type InspectionDepth = 0.5 | 1 | 2 | 2.5

const inspectionDepths: InspectionDepth[] = [0.5, 1, 2, 2.5]

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
}: {
  playbackUrl: string | null
  inspectionDepth: InspectionDepth
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const { currentTimelineAnchor, isInternalSeeking, completeInternalSeek, syncMediaPlayback } =
    useAxisChronologyStore(
      useShallow((state) => ({
        currentTimelineAnchor: state.currentTimelineAnchor,
        isInternalSeeking: state.isInternalSeeking,
        completeInternalSeek: state.completeInternalSeek,
        syncMediaPlayback: state.syncMediaPlayback,
      }))
    )

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
      <div className="relative overflow-hidden">
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
          className="aspect-video w-full bg-black object-contain transition-transform duration-[120ms] ease-[cubic-bezier(0.2,0,0.18,1)]"
          style={{
            transform: `scale(${inspectionDepth})`,
          }}
        />
        <div className="axis-mono pointer-events-none absolute bottom-4 left-4 text-[10px] font-black uppercase tracking-[0.28em] text-white/38 drop-shadow-[0_0_8px_rgba(242,241,237,0.14)]">
          AXIS
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
    <div className="mt-4 bg-white/[0.012] px-4 py-4">
      <div
        className="relative h-12"
        onClick={(event) => {
          jumpToNearestAtPosition(event.clientX, event.currentTarget)
        }}
      >
        {Array.from({
          length: granularity + 1,
        }).map((_, index) => (
          <span
            key={index}
            className="absolute top-1/2 h-3 -translate-y-1/2 border-l border-white/[0.045]"
            style={{
              left: `${(index / granularity) * 100}%`,
            }}
          />
        ))}
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/18" />
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
                  ? "bg-[#f2f1ed] shadow-[0_0_16px_rgba(242,241,237,0.22)]"
                  : "bg-zinc-300/35 hover:bg-[#f2f1ed]"
              }`}
              style={{
                left: `${position}%`,
              }}
            />
          )
        })}
      </div>
      <div className="axis-mono mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
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
    <div className="mt-4 flex items-center justify-between bg-white/[0.01] px-4 py-3">
      <p className="axis-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
        Optical depth
      </p>
      <div className="grid grid-cols-4">
        {inspectionDepths.map((depth) => {
          const active = depth === inspectionDepth

          return (
            <button
              key={depth}
              type="button"
              onClick={() => setInspectionDepth(depth)}
              className={`axis-mono axis-optical-transition h-8 min-w-12 px-3 text-[10px] font-semibold transition ${
                active
                  ? "bg-[#f2f1ed] text-black"
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

function SnapshotStrip() {
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

  if (!snapshots.length) return null

  const jumpToSnapshot = (snapshot: AxisSnapshot) => {
    const snapshotEvent = events.find(
      (event) =>
        event.type === "SNAPSHOT" &&
        (event.payload?.snapshot_id === snapshot.id ||
          Math.abs(Number(event.session_time) - Number(snapshot.session_time)) < 0.01)
    )

    if (snapshotEvent) requestEventJump(snapshotEvent.id)
    if (sessionId) {
      recordReplayNegotiation({
        sessionId,
        sessionTime: Number(snapshot.session_time) || 0,
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
    <section className="mt-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {snapshots.map((snapshot) => {
          const source = snapshot.image_url || snapshot.localUrl
          const chapter = chapterForSnapshot(snapshot)

          return (
            <div
              key={snapshot.id}
              className="min-w-32 bg-black/36"
            >
              <button
                type="button"
                onClick={() => jumpToSnapshot(snapshot)}
                className="axis-optical-transition block text-left transition active:bg-white/10"
              >
                {source ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={source}
                    alt={`Snapshot at ${formatClock(snapshot.session_time)}`}
                    className="aspect-video w-32 object-cover grayscale-[18%]"
                  />
                ) : (
                  <div className="grid aspect-video w-32 place-items-center bg-zinc-950 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
                    SNAP
                  </div>
                )}
              </button>
              <div className="px-2 py-2">
                <p className="axis-mono text-[10px] font-bold text-zinc-100">
                  {formatClock(snapshot.session_time)}
                </p>
                {chapter ? (
                  <p className="axis-mono mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#d7c08a]">
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
    </section>
  )
}

export function SessionReplayCanvas({ session }: { session: TemporalSessionRecord }) {
  const [inspectionDepth, setInspectionDepth] = useState<InspectionDepth>(1)
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
    <main className="axis-display min-h-dvh bg-black text-[#f2f1ed]">
      <section className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-4 sm:px-6">
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

        <div className="flex flex-col gap-4 py-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="axis-mono text-sm font-semibold uppercase tracking-[0.18em] text-zinc-300">
              {compactNodeId(session.id)}
            </p>
            <p className="mt-2 text-5xl font-bold leading-none tracking-normal text-[#f2f1ed] sm:text-6xl">
              {formatPreciseClock(session.duration_seconds)}
            </p>
            <p className="axis-mono mt-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-600">
              LOCKED
            </p>
            <p className="axis-mono mt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
              {formatEnvironmentalTimestamp(session.created_at)}
            </p>
          </div>
          <DeviceExportControl session={session} />
        </div>

        <div className="grid flex-1 gap-5 py-5">
          <section className="min-w-0">
            <ReplayVideo
              playbackUrl={session.playback_url}
              inspectionDepth={inspectionDepth}
            />
            <InspectionDepthControl
              inspectionDepth={inspectionDepth}
              setInspectionDepth={setInspectionDepth}
            />
            <EventRail inspectionDepth={inspectionDepth} />
            <SnapshotStrip />
          </section>
        </div>
      </section>
    </main>
  )
}
