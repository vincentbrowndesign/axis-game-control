"use client"

import { useEffect, useMemo, useState } from "react"
import MuxPlayer from "@mux/mux-player-react"

type EventType = "PASS" | "DRIVE" | "SHOT" | "TURNOVER"

type GameEvent = {
  type: EventType
  timestamp: number
}

type Session = {
  id: string
  title: string | null
  created_at: string
  playback_id: string | null
  video_url: string | null
}

type Analysis = {
  pace: string
  summary: string
}

export default function AxisReplayClient({
  sessionId,
}: {
  sessionId: string
}) {
  const [session, setSession] = useState<Session | null>(null)
  const [events, setEvents] = useState<GameEvent[]>([])
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch(`/api/session/${sessionId}`)
        const data = await res.json()

        console.log("SESSION DATA", data)

        setSession(data.session)
        setEvents(data.events ?? [])
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [sessionId])

  const playbackId = session?.playback_id ?? null

  const latestEvent = useMemo(() => {
    if (!events.length) return null
    return events[events.length - 1]
  }, [events])

  function addEvent(type: EventType) {
    const timestamp = Math.round(performance.now() / 100) / 10

    setEvents((prev) => [
      ...prev,
      {
        type,
        timestamp,
      },
    ])
  }

  function analyzeSession() {
    const passes = events.filter((e) => e.type === "PASS").length
    const drives = events.filter((e) => e.type === "DRIVE").length
    const shots = events.filter((e) => e.type === "SHOT").length
    const turnovers = events.filter((e) => e.type === "TURNOVER").length

    let pace = "LIVE POSSESSION"
    let summary = "Possession is active. Add more signals to read the flow."

    if (passes >= 2 && shots >= 1) {
      pace = "FAST FLOW"
      summary = "Ball movement created an early rhythm before the finish."
    }

    if (drives >= 1 && shots >= 1) {
      pace = "COLLAPSE ACTION"
      summary = "Drive pressure compressed help timing into a finish window."
    }

    if (turnovers >= 1) {
      pace = "BROKEN POSSESSION"
      summary = "Possession stability broke before a clean outcome formed."
    }

    setAnalysis({ pace, summary })
  }

  return (
    <main className="min-h-screen bg-black px-5 pb-32 pt-8 text-white">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-[48px] font-black leading-[1.15] tracking-[0.32em]">
          AXIS
          <br />
          REPLAY
        </h1>

        <div className="mt-8 rounded-[28px] border border-white/10 p-6">
          <p className="break-all text-[20px] tracking-[0.2em] text-neutral-400">
            {loading ? "LOADING" : session?.title ?? "AXIS SESSION"}
          </p>

          <p className="mt-3 text-neutral-500">
            {session?.created_at
              ? new Date(session.created_at).toLocaleString()
              : ""}
          </p>

          <p className="mt-3 break-all text-xs text-neutral-600">
            playback_id: {playbackId ?? "NONE"}
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-neutral-950">
          {playbackId ? (
            <MuxPlayer
              playbackId={playbackId}
              streamType="on-demand"
              accentColor="#ffffff"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center text-2xl">
              NO VIDEO
            </div>
          )}
        </div>

        <div className="mt-6 rounded-[28px] border border-white/10 p-6">
          <p className="text-sm tracking-[0.3em] text-neutral-500">
            AXIS READ
          </p>

          <h2 className="mt-5 text-5xl font-black uppercase leading-none tracking-[0.2em]">
            {analysis?.pace ?? "LIVE POSSESSION"}
          </h2>

          <div className="mt-10 flex items-center gap-8 text-5xl">
            <span>•••▶</span>
            <span>●</span>
          </div>

          <p className="mt-10 text-[18px] leading-[1.9] text-neutral-400">
            {analysis?.summary ?? "Tap the possession, then analyze the flow."}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          {(["PASS", "DRIVE", "SHOT", "TURNOVER"] as EventType[]).map(
            (type) => (
              <button
                key={type}
                onClick={() => addEvent(type)}
                className="rounded-[22px] border border-white/10 py-7 text-2xl font-black tracking-[0.22em]"
              >
                {type === "TURNOVER" ? "TO" : type}
              </button>
            )
          )}
        </div>

        <button
          onClick={analyzeSession}
          className="mt-6 w-full rounded-[22px] bg-white py-7 text-2xl font-black tracking-[0.3em] text-black"
        >
          ANALYZE
        </button>

        {!!events.length && (
          <div className="mt-8">
            <p className="mb-5 text-sm tracking-[0.3em] text-neutral-500">
              RHYTHM STRIP
            </p>

            <div className="flex gap-3 overflow-x-auto pb-4">
              {events.map((event, index) => {
                const previous = index > 0 ? events[index - 1] : null

                const gap = previous
                  ? (event.timestamp - previous.timestamp).toFixed(1)
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

                    <p className="mt-2 text-3xl font-black">{gap}s</p>
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

            <p className="mt-6 text-4xl font-black tracking-[0.2em]">
              {latestEvent.type}
            </p>
          </div>
        )}
      </div>
    </main>
  )
}