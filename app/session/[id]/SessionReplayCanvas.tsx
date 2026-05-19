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
  buildSnapshotSignalInput,
  exportSnapshotSignal,
  type SignalExportStatus,
} from "@/lib/signalExport"
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
type ReplayMode = "RECON" | "MOTION_ECHO"

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

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function signalCoordinates(seed: number, index: number) {
  const phase = seed * 0.09 + index * 1.7

  return {
    x: 18 + ((Math.sin(phase) + 1) / 2) * 58,
    y: 18 + ((Math.cos(phase * 0.82) + 1) / 2) * 56,
  }
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
}

function ReplayVideo({
  playbackUrl,
  inspectionDepth,
  replayMode,
  duration,
}: {
  playbackUrl: string | null
  inspectionDepth: InspectionDepth
  replayMode: ReplayMode
  duration: number
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
    <div className="overflow-hidden border border-white/10 bg-[#050505]">
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
        {replayMode === "MOTION_ECHO" ? (
          <SignalPerceptionOverlay duration={duration} inspectionDepth={inspectionDepth} />
        ) : null}
      </div>
    </div>
  )
}

function SignalPerceptionOverlay({
  duration,
  inspectionDepth,
}: {
  duration: number
  inspectionDepth: InspectionDepth
}) {
  const { snapshots, events, playback, activeEventId } = useAxisChronologyStore(
    useShallow((state) => ({
      snapshots: state.snapshots,
      events: state.events,
      playback: state.playback,
      activeEventId: state.activeEventId,
    }))
  )
  const currentTime = Number(playback.currentTimelineAnchor || playback.currentTime) || 0
  const safeDuration = Math.max(1, Number(duration) || 1)
  const isMoving = Boolean(playback.isPlaying && !playback.paused && !playback.isSeeking)
  const activeEvent = events.find((event) => event.id === activeEventId)
  const nearestSnapshot = snapshots.reduce<AxisSnapshot | null>((nearest, snapshot) => {
    if (!nearest) return snapshot
    return Math.abs(snapshot.session_time - currentTime) <
      Math.abs(nearest.session_time - currentTime)
      ? snapshot
      : nearest
  }, null)
  const anchorTime = Number(activeEvent?.session_time ?? nearestSnapshot?.session_time ?? currentTime)
  const densityWindow = 5 / inspectionDepth
  const density = clamp01(
    events.filter((event) => Math.abs(Number(event.session_time) - currentTime) <= densityWindow)
      .length / 6
  )
  const anchorProximity = clamp01(1 - Math.abs(currentTime - anchorTime) / Math.max(0.75, densityWindow))
  const motionEnergy = isMoving
    ? clamp01(0.22 + density * 0.36 + anchorProximity * 0.24 + (Math.sin(currentTime * 4.2) + 1) * 0.1)
    : 0

  if (motionEnergy < 0.08) return null

  const baseSeed = currentTime * (13 + motionEnergy * 9) + safeDuration
  const boxes = [0, 1, 2].map((index) => {
    const point = signalCoordinates(baseSeed + index * motionEnergy * 3.2, index)
    const stabilization = clamp01(0.24 + motionEnergy * 0.6 + density * 0.18)
    const looseness = 1 - stabilization

    return {
      ...point,
      width: 8.5 + looseness * 8,
      height: 11 + looseness * 9,
      energy: stabilization,
    }
  })
  const tension = signalCoordinates(baseSeed + motionEnergy * 9, 6)
  const echoSteps = [1, 2, 3, 4]

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden mix-blend-screen"
      style={{
        opacity: 0.56 + motionEnergy * 0.32,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="axis-optical-drift absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="axis-tension-zone" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(215,192,138,0.18)" />
            <stop offset="48%" stopColor="rgba(242,241,237,0.04)" />
            <stop offset="100%" stopColor="rgba(242,241,237,0)" />
          </radialGradient>
        </defs>
        <circle
          cx={tension.x}
          cy={tension.y}
          r={8 + density * 7 + motionEnergy * 8}
          fill="url(#axis-tension-zone)"
          opacity={0.12 + motionEnergy * 0.28}
        />
        {boxes.map((box, index) => {
          const next = boxes[(index + 1) % boxes.length]
          const previousPoint = signalCoordinates(baseSeed - (index + 1) * (2 + motionEnergy * 5), index)

          return (
            <g key={index}>
              {echoSteps.map((step) => {
                const echo = signalCoordinates(baseSeed - step * (2.5 + motionEnergy * 4), index)
                const echoOpacity = Math.max(0, 0.18 - step * 0.032) * motionEnergy

                return (
                  <rect
                    key={step}
                    x={echo.x - step * 0.2}
                    y={echo.y + step * 0.16}
                    width={box.width + step * 1.8}
                    height={box.height + step * 1.4}
                    fill="none"
                    stroke="rgba(242,241,237,0.44)"
                    strokeWidth={0.07}
                    opacity={echoOpacity}
                  />
                )
              })}
              <path
                d={`M ${previousPoint.x + box.width / 2} ${previousPoint.y + box.height / 2} Q ${
                  (box.x + next.x) / 2
                } ${box.y - 6 - motionEnergy * 11} ${next.x + next.width / 2} ${
                  next.y + next.height / 2
                }`}
                fill="none"
                stroke="rgba(242,241,237,0.25)"
                strokeWidth={0.08 + motionEnergy * 0.13}
                strokeLinecap="round"
                opacity={0.12 + motionEnergy * 0.46}
              />
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                fill="none"
                stroke="rgba(242,241,237,0.52)"
                strokeWidth={0.09 + box.energy * 0.07}
                opacity={0.18 + box.energy * 0.44}
              />
              <rect
                x={box.x - 0.5 - motionEnergy}
                y={box.y - 0.5 - motionEnergy}
                width={box.width + 1 + motionEnergy * 2}
                height={box.height + 1 + motionEnergy * 2}
                fill="none"
                stroke="rgba(185,215,191,0.22)"
                strokeWidth={0.07}
                opacity={motionEnergy * (0.18 + anchorProximity * 0.4)}
              />
              <circle
                cx={box.x + box.width / 2}
                cy={box.y + box.height / 2}
                r={2 + box.energy * 4.4 + anchorProximity * 2}
                fill="none"
                stroke="rgba(215,192,138,0.3)"
                strokeWidth={0.08}
                opacity={motionEnergy > 0.48 ? motionEnergy * 0.44 : 0}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function EventRail({ inspectionDepth }: { inspectionDepth: InspectionDepth }) {
  const { events, duration, activeEventId, requestEventJump } =
    useAxisChronologyStore(
      useShallow((state) => ({
        events: state.events,
        duration: state.duration,
        activeEventId: state.activeEventId,
        requestEventJump: state.requestEventJump,
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
  }

  return (
    <div className="mt-4 border border-white/10 bg-white/[0.02] px-4 py-4">
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
              }}
              aria-label={`Jump to snapshot at ${formatClock(event.session_time)}`}
              className={`axis-optical-transition absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 border text-[0] transition ${
                active
                  ? "border-[#f2f1ed] bg-[#f2f1ed] shadow-[0_0_16px_rgba(242,241,237,0.22)]"
                  : "border-white/20 bg-zinc-300/35 hover:bg-[#f2f1ed]"
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
    <div className="mt-4 flex items-center justify-between border border-white/10 bg-white/[0.015] px-4 py-3">
      <p className="axis-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
        Optical depth
      </p>
      <div className="grid grid-cols-4 border border-white/10">
        {inspectionDepths.map((depth) => {
          const active = depth === inspectionDepth

          return (
            <button
              key={depth}
              type="button"
              onClick={() => setInspectionDepth(depth)}
              className={`axis-mono axis-optical-transition h-8 min-w-12 border-r border-white/10 px-3 text-[10px] font-semibold transition last:border-r-0 ${
                active
                  ? "bg-[#f2f1ed] text-black"
                  : "bg-black text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300"
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

function ReplayModeToggle({
  replayMode,
  setReplayMode,
}: {
  replayMode: ReplayMode
  setReplayMode: (mode: ReplayMode) => void
}) {
  return (
    <div className="mb-4 flex items-center justify-between border border-white/10 bg-white/[0.015] px-4 py-3">
      <p className="axis-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
        Perception
      </p>
      <div className="grid grid-cols-2 border border-white/10">
        {(["RECON", "MOTION_ECHO"] as ReplayMode[]).map((mode) => {
          const active = replayMode === mode
          const label = mode === "MOTION_ECHO" ? "MOTION ECHO" : mode

          return (
            <button
              key={mode}
              type="button"
              onClick={() => setReplayMode(mode)}
              className={`axis-mono axis-optical-transition h-8 min-w-24 border-r border-white/10 px-3 text-[10px] font-semibold transition last:border-r-0 ${
                active
                  ? "bg-[#f2f1ed] text-black"
                  : "bg-black text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300"
              }`}
            >
              {label}
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
  const { exportStatus, exportProgress, executeNativeExport } = useAxisChronologyStore(
    useShallow((state) => ({
      exportStatus: state.exportStatus,
      exportProgress: state.exportProgress,
      executeNativeExport: state.executeNativeExport,
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
          void executeNativeExport(session.playback_url, `axis-record-${session.id}`)
        }}
        className="axis-mono axis-optical-transition border border-white/10 bg-[#f2f1ed] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-black transition disabled:cursor-wait disabled:bg-white/10 disabled:text-zinc-500"
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

function signalStatusLabel(status: SignalExportStatus) {
  if (status === "DOWNLOADING") return "SOURCE"
  if (status === "RENDERING") return "RENDER"
  if (status === "PREPARING_TRANSFER") return "TRANSFER"
  if (status === "SUCCESS") return "READY"
  if (status === "FAILED") return "HOLD"
  return "SIGNAL"
}

function densityNearSnapshot(
  events: TemporalEventRecord[],
  snapshot: AxisSnapshot,
  duration: number
) {
  const anchor = Number(snapshot.session_time) || 0
  const windowSize = Math.max(3, Math.min(8, Math.max(1, duration) * 0.08))
  const nearbyCount = events.filter(
    (event) => Math.abs(Number(event.session_time) - anchor) <= windowSize
  ).length

  return Math.min(1, nearbyCount / 6)
}

function SnapshotStrip({ session }: { session: TemporalSessionRecord }) {
  const [signalStatus, setSignalStatus] = useState<SignalExportStatus>("IDLE")
  const [activeSignalSnapshotId, setActiveSignalSnapshotId] = useState<string | null>(null)
  const { snapshots, requestEventJump, events, updateSnapshotAnnotation } =
    useAxisChronologyStore(
      useShallow((state) => ({
        snapshots: state.snapshots,
        requestEventJump: state.requestEventJump,
        events: state.events,
        updateSnapshotAnnotation: state.updateSnapshotAnnotation,
      }))
    )

  if (!snapshots.length) return null

  const exportSignal = async (snapshot: AxisSnapshot) => {
    if (!session.playback_url || activeSignalSnapshotId) return

    setActiveSignalSnapshotId(snapshot.id)
    setSignalStatus("DOWNLOADING")

    try {
      const nodeId = compactNodeId(session.id)
      await exportSnapshotSignal({
        playbackUrl: session.playback_url,
        signal: buildSnapshotSignalInput({
          sessionId: session.id,
          snapshot,
          nodeId,
          duration: Number(session.duration_seconds) || 0,
          kineticDensity: densityNearSnapshot(events, snapshot, Number(session.duration_seconds) || 0),
          acousticPeak: 0,
        }),
        title: `axis-signal-${nodeId}-${formatPreciseClock(
          snapshot.session_time
        )}`,
        onStatus: setSignalStatus,
      })
    } catch {
      setSignalStatus("FAILED")
    } finally {
      window.setTimeout(() => {
        setActiveSignalSnapshotId(null)
        setSignalStatus("IDLE")
      }, 1500)
    }
  }

  const jumpToSnapshot = (snapshot: AxisSnapshot) => {
    const snapshotEvent = events.find(
      (event) =>
        event.type === "SNAPSHOT" &&
        (event.payload?.snapshot_id === snapshot.id ||
          Math.abs(Number(event.session_time) - Number(snapshot.session_time)) < 0.01)
    )

    if (snapshotEvent) requestEventJump(snapshotEvent.id)
  }

  return (
    <section className="mt-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {snapshots.map((snapshot) => {
          const source = snapshot.image_url || snapshot.localUrl

          return (
            <div
              key={snapshot.id}
              className="min-w-32 border border-white/10 bg-black/50"
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
                <input
                  type="text"
                  value={snapshot.annotation}
                  onChange={(event) =>
                    updateSnapshotAnnotation(snapshot.id, event.currentTarget.value)
                  }
                  placeholder="note"
                  maxLength={120}
                  aria-label={`Snapshot note at ${formatClock(snapshot.session_time)}`}
                  className="axis-mono axis-optical-transition mt-2 w-full border-0 border-b border-white/10 bg-transparent px-0 py-1 text-[11px] font-semibold lowercase text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-[#d7c08a]/60"
                />
                {session.playback_url ? (
                  <button
                    type="button"
                    disabled={Boolean(activeSignalSnapshotId)}
                    onClick={() => {
                      void exportSignal(snapshot)
                    }}
                    className="axis-mono axis-optical-transition mt-3 w-full border border-white/10 px-2 py-2 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500 transition hover:border-[#d7c08a]/40 hover:text-zinc-200 disabled:cursor-wait disabled:text-zinc-700"
                  >
                    {activeSignalSnapshotId === snapshot.id
                      ? signalStatusLabel(signalStatus)
                      : "SIGNAL"}
                  </button>
                ) : null}
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
  const [replayMode, setReplayMode] = useState<ReplayMode>("RECON")
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
        <header className="border-b border-white/10 py-3">
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

        <div className="flex flex-col gap-4 border-b border-white/10 py-5 md:flex-row md:items-end md:justify-between">
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
            <ReplayModeToggle replayMode={replayMode} setReplayMode={setReplayMode} />
            <ReplayVideo
              playbackUrl={session.playback_url}
              inspectionDepth={inspectionDepth}
              replayMode={replayMode}
              duration={Number(session.duration_seconds) || 0}
            />
            <InspectionDepthControl
              inspectionDepth={inspectionDepth}
              setInspectionDepth={setInspectionDepth}
            />
            <EventRail inspectionDepth={inspectionDepth} />
            <SnapshotStrip session={session} />
          </section>
        </div>
      </section>
    </main>
  )
}
