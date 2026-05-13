// components/AxisReplayClient.tsx

"use client"

import { useEffect, useMemo, useState } from "react"
import MuxPlayer from "@mux/mux-player-react"

type EventType =
  | "PASS"
  | "DRIVE"
  | "SHOT"
  | "TURNOVER"

type GameEvent = {
  type: EventType
  timestamp: number
}

type Session = {
  id: string
  title: string
  created_at: string
  playback_id: string | null
}

type Analysis = {
  pace: string
  momentum: string
  summary: string
}

export default function AxisReplayClient({
  sessionId,
}: {
  sessionId?: string
}) {
  const [session, setSession] =
    useState<Session | null>(null)

  const [events, setEvents] = useState<GameEvent[]>(
    []
  )

  const [analysis, setAnalysis] =
    useState<Analysis | null>(null)

  const [selectedShotResult, setSelectedShotResult] =
    useState<"MAKE" | "MISS" | null>(null)

  useEffect(() => {
    if (!sessionId) return

    async function loadSession() {
      try {
        const response = await fetch(
          `/api/session/${sessionId}`
        )

        const data = await response.json()

        setSession(data.session)
        setEvents(data.events || [])
      } catch (error) {
        console.error(error)
      }
    }

    loadSession()
  }, [sessionId])

  const playbackId = session?.playback_id || null

  const latestEvent = useMemo(() => {
    if (!events.length) return null

    return events[events.length - 1]
  }, [events])

  async function addEvent(type: EventType) {
    if (!sessionId) return

    const timestamp =
      typeof window !== "undefined"
        ? Math.round(performance.now() / 100) / 10
        : 0

    const newEvent: GameEvent = {
      type,
      timestamp,
    }

    setEvents((prev) => [...prev, newEvent])

    try {
      await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          event: newEvent,
        }),
      })
    } catch (error) {
      console.error(error)
    }
  }

  async function analyzeSession() {
    if (!events.length) return

    const passes = events.filter(
      (e) => e.type === "PASS"
    ).length

    const drives = events.filter(
      (e) => e.type === "DRIVE"
    ).length

    const shots = events.filter(
      (e) => e.type === "SHOT"
    ).length

    const turnovers = events.filter(
      (e) => e.type === "TURNOVER"
    ).length

    let pace = "LIVE POSSESSION"
    let momentum = "NEUTRAL FLOW"
    let summary =
      "Tap the possession, then analyze the flow."

    if (passes >= 3 && shots >= 1) {
      pace = "FAST FLOW"
      momentum = "ADVANTAGE CREATED"
      summary =
        "Ball movement accelerated defensive responsibility."
    }

    if (drives >= 1 && shots >= 1) {
      pace = "COLLAPSE ACTION"
      momentum = "DEFENSE SHIFTED"
      summary =
        "Drive pressure compressed help timing."
    }

    if (turnovers >= 1) {
      pace = "BROKEN POSSESSION"
      momentum = "PRESSURE WON"
      summary =
        "Possession stability collapsed under pressure."
    }

    setAnalysis({
      pace,
      momentum,
      summary,
    })
  }

  return (
    <main className="min-h-screen bg-black px-5 pb-32 pt-8 text-white">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-[42px] font-black tracking-[0.35em]">
          AXIS REPLAY
        </h1>

        <div className="mt-6 rounded-[28px] border border-white/10 p-6">
          <p className="break-all text-[20px] tracking-[0.2em] text-neutral-400">
            {session?.title || "LOADING"}
          </p>

          <p className="mt-3 text-neutral-500">
            {session?.created_at
              ? new Date(
                  session.created_at
                ).toLocaleString()
              : ""}
          </p>
        </div>

        {playbackId ? (
          <div className="mt-6 overflow-hidden rounded-[28px]">
            <MuxPlayer
              playbackId={playbackId}
              streamType="on-demand"
              accentColor="#ffffff"
            />
          </div>
        ) : (
          <div className="mt-6 flex aspect-video items-center justify-center rounded-[28px] border border-white/10 bg-neutral-950">
            NO VIDEO
          </div>
        )}

        <div className="mt-6 rounded-[28px] border border-white/10 p-6">
          <p className="text-sm tracking-[0.3em] text-neutral-500">
            AXIS READ
          </p>

          <h2 className="mt-5 text-5xl font-black uppercase leading-none tracking-[0.2em]">
            {analysis?.pace ||
              "LIVE POSSESSION"}
          </h2>

          <div className="mt-10 flex items-center gap-8 text-5xl">
            <span>•••▶</span>
            <span>●</span>
          </div>

          <p className="mt-10 text-[18px] leading-[1.9] text-neutral-400">
            {analysis?.summary ||
              "Tap the possession, then analyze the flow."}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <button
            onClick={() => addEvent("PASS")}
            className="rounded-[22px] border border-white/10 py-7 text-2xl font-black tracking-[0.25em]"
          >
            PASS
          </button>

          <button
            onClick={() => addEvent("DRIVE")}
            className="rounded-[22px] border border-white/10 py-7 text-2xl font-black tracking-[0.25em]"
          >
            DRIVE
          </button>

          <button
            onClick={() => addEvent("SHOT")}
            className="rounded-[22px] border border-white/10 py-7 text-2xl font-black tracking-[0.25em]"
          >
            SHOT
          </button>

          <button
            onClick={() => addEvent("TURNOVER")}
            className="rounded-[22px] border border-white/10 py-7 text-2xl font-black tracking-[0.25em]"
          >
            TURNOVER
          </button>
        </div>

        <button
          onClick={analyzeSession}
          className="mt-6 w-full rounded-[22px] bg-white py-7 text-2xl font-black tracking-[0.3em] text-black"
        >
          ANALYZE
        </button>

        <div className="mt-8 rounded-[28px] border border-white/10 p-6">
          <p className="text-sm tracking-[0.3em] text-neutral-500">
            SHOT CONTEXT
          </p>

          <div className="mt-8">
            <p className="text-sm tracking-[0.25em] text-neutral-500">
              RESULT
            </p>

            <div className="mt-4 flex gap-4">
              <button
                onClick={() =>
                  setSelectedShotResult("MAKE")
                }
                className={`flex-1 rounded-[18px] border py-5 text-xl font-bold tracking-[0.2em] ${
                  selectedShotResult === "MAKE"
                    ? "border-white bg-white text-black"
                    : "border-white/10 text-white"
                }`}
              >
                MAKE
              </button>

              <button
                onClick={() =>
                  setSelectedShotResult("MISS")
                }
                className={`flex-1 rounded-[18px] border py-5 text-xl font-bold tracking-[0.2em] ${
                  selectedShotResult === "MISS"
                    ? "border-white bg-white text-black"
                    : "border-white/10 text-white"
                }`}
              >
                MISS
              </button>
            </div>
          </div>
        </div>

        {!!events.length && (
          <div className="mt-8">
            <p className="mb-5 text-sm tracking-[0.3em] text-neutral-500">
              RHYTHM STRIP
            </p>

            <div className="flex gap-3 overflow-x-auto pb-4">
              {events.map((event, index) => {
                const prev =
                  index > 0
                    ? events[index - 1]
                    : null

                const gap = prev
                  ? (
                      event.timestamp -
                      prev.timestamp
                    ).toFixed(1)
                  : "0.0"

                return (
                  <div
                    key={`${event.type}-${index}`}
                    className="min-w-[140px] rounded-[24px] border border-white/10 p-5"
                  >
                    <p className="text-sm tracking-[0.2em] text-neutral-500">
                      EVENT
                    </p>

                    <p className="mt-4 text-2xl font-black tracking-[0.2em]">
                      {event.type}
                    </p>

                    <p className="mt-6 text-sm tracking-[0.2em] text-neutral-500">
                      GAP
                    </p>

                    <p className="mt-2 text-3xl font-black">
                      {gap}s
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {latestEvent && (
          <div className="mt-8 rounded-[28px] border border-white/10 p-6">
            <p className="text-sm tracking-[0.3em] text-neutral-500">
              LIVE SIGNAL
            </p>

            <div className="mt-6 flex items-center justify-between">
              <div>
                <p className="text-4xl font-black tracking-[0.2em]">
                  {latestEvent.type}
                </p>

                <p className="mt-3 text-neutral-500">
                  Last event captured
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm tracking-[0.2em] text-neutral-500">
                  TIMESTAMP
                </p>

                <p className="mt-2 text-3xl font-black">
                  {latestEvent.timestamp}s
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}