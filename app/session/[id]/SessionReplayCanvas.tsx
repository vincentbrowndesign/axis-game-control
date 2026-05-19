"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
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

function eventPreroll(event: TemporalEventRecord) {
  const before = event.payload?.replay_window?.before
  return Number.isFinite(before) ? Number(before) : 0
}

export function seekToEvent(
  videoElement: HTMLVideoElement | null,
  event: TemporalEventRecord
) {
  if (!videoElement) return

  const target = Math.max(0, Number(event.session_time) - eventPreroll(event))

  videoElement.pause()
  videoElement.currentTime = target
}

export function SessionReplayCanvas({ session }: { session: TemporalSessionRecord }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [events, setEvents] = useState<TemporalEventRecord[]>([])
  const [snapshots, setSnapshots] = useState<TemporalSnapshotRecord[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [eventsLoaded, setEventsLoaded] = useState(false)

  useEffect(() => {
    let active = true

    async function loadEvents() {
      try {
        const response = await fetch(`/api/live/session/${session.id}`, {
          cache: "no-store",
        })
        const payload = (await response.json().catch(() => ({}))) as SessionPayload

        if (!active) return
        setEvents(payload.events || [])
        setSnapshots(payload.snapshots || [])
      } finally {
        if (active) setEventsLoaded(true)
      }
    }

    void loadEvents()

    return () => {
      active = false
    }
  }, [session.id])

  const duration = Math.max(Number(session.duration_seconds) || 0, 1)
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId]
  )

  const jumpToEvent = (event: TemporalEventRecord) => {
    setSelectedEventId(event.id)
    seekToEvent(videoRef.current, event)
  }

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

        <div className="grid gap-3 border-b border-white/10 py-4 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
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
        </div>

        <div className="grid flex-1 gap-5 py-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="min-w-0">
            {session.playback_url ? (
              <div className="overflow-hidden border border-white/10 bg-zinc-950">
                <video
                  ref={videoRef}
                  src={session.playback_url}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full bg-black object-contain"
                />
              </div>
            ) : (
              <div className="grid aspect-video place-items-center border border-white/10 bg-zinc-950 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">
                  RECORD PROCESSING
                </p>
              </div>
            )}

            <div className="mt-4 border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="relative h-12">
                <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/18" />
                {events.map((event) => {
                  const position = Math.min(
                    100,
                    Math.max(0, (Number(event.session_time) / duration) * 100)
                  )
                  const active = event.id === selectedEventId

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => jumpToEvent(event)}
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
                <span>{formatClock(session.duration_seconds)}</span>
              </div>
            </div>

            {selectedEvent ? (
              <div className="mt-4 border-l border-zinc-100/70 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
                  Selected
                </p>
                <p className="mt-1 text-sm font-black uppercase tracking-[0.16em] text-zinc-100">
                  {selectedEvent.type} · {formatClock(selectedEvent.session_time)}
                </p>
              </div>
            ) : null}
          </section>

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
                {snapshots.length} snapshots
              </p>
            </div>

            <div className="mt-4 grid gap-2">
              {events.map((event) => {
                const active = event.id === selectedEventId

                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => jumpToEvent(event)}
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
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">
                      Jump
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
        </div>
      </section>
    </main>
  )
}
