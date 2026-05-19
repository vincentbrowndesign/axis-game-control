"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useShallow } from "zustand/react/shallow"
import {
  type AxisSnapshot,
  type TimelineAnchor,
  useAxisChronologyStore,
} from "@/lib/axisChronologyStore"
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

function formatClock(totalSeconds: number | null | undefined) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export function seekToEvent(
  videoElement: HTMLVideoElement | null,
  anchor: TimelineAnchor | null
) {
  if (!videoElement || !anchor) return

  videoElement.pause()
  videoElement.currentTime = anchor.targetTime
}

function ReplayVideo({ playbackUrl }: { playbackUrl: string | null }) {
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

    seekToEvent(videoRef.current, currentTimelineAnchor)
  }, [currentTimelineAnchor, isInternalSeeking])

  useEffect(() => {
    const restoreFromChronology = () => {
      const state = useAxisChronologyStore.getState()
      if (!state.currentTimelineAnchor) return

      seekToEvent(videoRef.current, state.currentTimelineAnchor)
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
      <div className="grid aspect-video place-items-center border border-white/10 bg-zinc-950 text-center">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">
          RECORD PROCESSING
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden border border-white/10 bg-zinc-950">
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
          syncMediaPlayback({
            currentTime: event.currentTarget.currentTime,
            paused: event.currentTarget.paused,
            readyState: event.currentTarget.readyState,
          })
        }}
        onPause={(event) => {
          syncMediaPlayback({
            currentTime: event.currentTarget.currentTime,
            paused: true,
            readyState: event.currentTarget.readyState,
          })
        }}
        onPlay={(event) => {
          syncMediaPlayback({
            currentTime: event.currentTarget.currentTime,
            paused: false,
            readyState: event.currentTarget.readyState,
          })
        }}
        onSeeked={(event) => {
          syncMediaPlayback({
            currentTime: event.currentTarget.currentTime,
            paused: event.currentTarget.paused,
            readyState: event.currentTarget.readyState,
          })
          completeInternalSeek()
        }}
        className="aspect-video w-full bg-black object-contain"
      />
    </div>
  )
}

function EventRail() {
  const { events, duration, activeEventId, requestEventJump } =
    useAxisChronologyStore(
      useShallow((state) => ({
        events: state.events,
        duration: state.duration,
        activeEventId: state.activeEventId,
        requestEventJump: state.requestEventJump,
      }))
    )
  const safeDuration = Math.max(duration, 1)
  const jumpToNearestAtPosition = (clientX: number, rail: HTMLDivElement) => {
    if (!events.length) return

    const bounds = rail.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width))
    const targetTime = ratio * safeDuration
    const nearestEvent = events.reduce((nearest, event) => {
      const nearestDistance = Math.abs(Number(nearest.session_time) - targetTime)
      const eventDistance = Math.abs(Number(event.session_time) - targetTime)
      return eventDistance < nearestDistance ? event : nearest
    }, events[0])

    requestEventJump(nearestEvent.id)
  }

  return (
    <div className="mt-4 border border-white/10 bg-white/[0.03] px-4 py-4">
      <div
        className="relative h-12"
        onClick={(event) => {
          jumpToNearestAtPosition(event.clientX, event.currentTarget)
        }}
      >
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/18" />
        {events.map((event) => {
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
              aria-label={`Jump to ${event.type} at ${formatClock(event.session_time)}`}
              className={`absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border text-[0] transition ${
                active
                  ? "border-zinc-100 bg-zinc-100 shadow-[0_0_20px_rgba(244,244,245,0.42)]"
                  : "border-white/20 bg-zinc-300/50 hover:bg-zinc-100"
              }`}
              style={{
                left: `${position}%`,
              }}
            />
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">
        <span>00:00</span>
        <span>{formatClock(duration)}</span>
      </div>
    </div>
  )
}

function SelectedEvent() {
  const { events, activeEventId, uiStatus } = useAxisChronologyStore(
    useShallow((state) => ({
      events: state.events,
      activeEventId: state.activeEventId,
      uiStatus: state.uiStatus,
    }))
  )
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === activeEventId) || null,
    [events, activeEventId]
  )

  if (!selectedEvent) return null

  return (
    <div className="mt-4 border-l border-zinc-100/70 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
        Selected
      </p>
      <p className="mt-1 text-sm font-black uppercase tracking-[0.16em] text-zinc-100">
        {selectedEvent.type} / {formatClock(selectedEvent.session_time)}
      </p>
      <p className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">
        {uiStatus}
      </p>
    </div>
  )
}

function EventFeed({
  eventsLoaded,
}: {
  eventsLoaded: boolean
}) {
  const { events, activeEventId, requestEventJump } = useAxisChronologyStore(
    useShallow((state) => ({
      events: state.events,
      activeEventId: state.activeEventId,
      requestEventJump: state.requestEventJump,
    }))
  )
  const { syncTelemetry, failedEventCount, retryFailedEvents } =
    useAxisChronologyStore(
      useShallow((state) => ({
        syncTelemetry: state.syncTelemetry,
        failedEventCount: state.failedEvents.length,
        retryFailedEvents: state.retryFailedEvents,
      }))
    )
  const snapshotCount = useAxisChronologyStore((state) => state.snapshots.length)

  return (
    <aside className="min-w-0 border-t border-white/10 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
            Events
          </p>
          <p className="mt-1 font-mono text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
            {eventsLoaded ? `${events.length} loaded` : "loading"}
          </p>
        </div>
        <p className="font-mono text-xs font-bold text-zinc-600">
          {snapshotCount} snapshots
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border border-white/10 bg-white/[0.03] px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
          {syncTelemetry}
        </p>
        {failedEventCount ? (
          <button
            type="button"
            onClick={() => retryFailedEvents()}
            className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-100"
          >
            Retry {failedEventCount}
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2">
        {events.map((event) => {
          const active = event.id === activeEventId

          return (
            <button
              key={event.id}
              type="button"
              onClick={() => requestEventJump(event.id)}
              className={`grid min-h-12 grid-cols-[4.5rem_1fr_auto] items-center gap-3 border px-3 py-3 text-left transition ${
                active
                  ? "border-zinc-100 bg-zinc-100 text-black"
                  : "border-white/10 bg-white/[0.03] text-zinc-100 active:bg-white/10"
              }`}
            >
              <span className="font-mono text-xs font-black">
                {formatClock(event.session_time)}
              </span>
              <span className="truncate text-xs font-black uppercase tracking-[0.16em]">
                {event.type}
              </span>
              <span className="text-right text-[10px] font-black uppercase tracking-[0.16em] opacity-70">
                {event.persistenceStatus === "PERSISTED" ? "Jump" : event.persistenceStatus}
              </span>
            </button>
          )
        })}

        {eventsLoaded && !events.length ? (
          <p className="border border-white/10 bg-white/[0.03] px-3 py-4 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
            NO EVENTS YET
          </p>
        ) : null}
      </div>
    </aside>
  )
}

function exportLabel(status: string) {
  if (status === "DOWNLOADING") return "DOWNLOADING"
  if (status === "PREPARING_TRANSFER") return "PREPARING TRANSFER"
  if (status === "SUCCESS") return "FILE READY"
  if (status === "FAILED") return "TRANSFER FAILED"
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
        className="border border-white/10 bg-zinc-100 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black disabled:cursor-wait disabled:bg-white/10 disabled:text-zinc-500"
      >
        {exportLabel(exportStatus)}
      </button>
      {exportStatus !== "IDLE" ? (
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">
          {exportStatus === "DOWNLOADING"
            ? `SYS_TRANSFER_ACTIVE ${exportProgress}%`
            : exportLabel(exportStatus)}
        </p>
      ) : null}
    </div>
  )
}

function SnapshotStrip() {
  const { snapshots, failedSnapshotCount, retryFailedSnapshots, requestEventJump, events } =
    useAxisChronologyStore(
      useShallow((state) => ({
        snapshots: state.snapshots,
        failedSnapshotCount: state.failedSnapshots.length,
        retryFailedSnapshots: state.retryFailedSnapshots,
        requestEventJump: state.requestEventJump,
        events: state.events,
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
  }

  return (
    <section className="mt-4 border border-white/10 bg-white/[0.025] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
          Snapshots
        </p>
        {failedSnapshotCount ? (
          <button
            type="button"
            onClick={() => retryFailedSnapshots()}
            className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-100"
          >
            Retry {failedSnapshotCount}
          </button>
        ) : null}
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {snapshots.map((snapshot) => {
          const source = snapshot.image_url || snapshot.localUrl

          return (
            <button
              key={snapshot.id}
              type="button"
              onClick={() => jumpToSnapshot(snapshot)}
              className="min-w-28 border border-white/10 bg-black/40 text-left active:bg-white/10"
            >
              {source ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={source}
                  alt={`Snapshot at ${formatClock(snapshot.session_time)}`}
                  className="aspect-video w-28 object-cover"
                />
              ) : (
                <div className="grid aspect-video w-28 place-items-center bg-zinc-950 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
                  SNAP
                </div>
              )}
              <div className="px-2 py-2">
                <p className="font-mono text-[10px] font-black text-zinc-100">
                  {formatClock(snapshot.session_time)}
                </p>
                <p className="mt-1 text-[8px] font-black uppercase tracking-[0.14em] text-zinc-600">
                  {snapshot.status}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function SessionReplayCanvas({ session }: { session: TemporalSessionRecord }) {
  const [eventsLoaded, setEventsLoaded] = useState(false)
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
        if (active) setEventsLoaded(true)
      }
    }

    void loadEvents()

    return () => {
      active = false
    }
  }, [hydrateChronology, hydrateSnapshots, session.duration_seconds, session.id])

  return (
    <main className="min-h-dvh bg-black text-zinc-100">
      <section className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-4 sm:px-6">
        <header className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-white/10 py-3">
          <Link
            href="/live"
            className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-100"
          >
            AXIS
          </Link>
          <div className="h-px bg-white/14" />
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-400">
            RECORD
          </p>
        </header>

        <div className="grid gap-3 border-b border-white/10 py-4 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
              Session
            </p>
            <p className="mt-1 max-w-full truncate font-mono text-xs font-bold uppercase tracking-[0.12em] text-zinc-300">
              {session.id}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
              Duration
            </p>
            <p className="mt-1 font-mono text-2xl font-black leading-none text-zinc-100">
              {formatClock(session.duration_seconds)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
              Created
            </p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-zinc-200">
              {formatDate(session.created_at)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
              Status
            </p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-zinc-200">
              {session.status}
            </p>
          </div>
          <DeviceExportControl session={session} />
        </div>

        <div className="grid flex-1 gap-5 py-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="min-w-0">
            <ReplayVideo playbackUrl={session.playback_url} />
            <EventRail />
            <SnapshotStrip />
            <SelectedEvent />
          </section>
          <EventFeed eventsLoaded={eventsLoaded} />
        </div>
      </section>
    </main>
  )
}
