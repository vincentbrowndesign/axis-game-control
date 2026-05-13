"use client"

import { useMemo, useRef, useState } from "react"

import {
  AxisEvent,
  AxisSession,
  createAxisEvent,
} from "@/lib/axisSessions"

import { AxisSessionAnalysis } from "@/lib/axisAnalysis"

type Props = {
  session: AxisSession
  initialEvents: AxisEvent[]
}

function getSymbol(label: string) {
  switch (label) {
    case "PASS":
      return "→"

    case "DRIVE":
      return "⇢"

    case "SHOT":
      return "●"

    case "STOP":
      return "×"

    default:
      return "•"
  }
}

function getStateLabel(
  analysis: AxisSessionAnalysis | null
) {
  if (!analysis) return "NO READ"

  if (analysis.tempo_label === "fast") {
    return "GOOD FLOW"
  }

  if (analysis.tempo_label === "balanced") {
    return "LIVE POSSESSION"
  }

  return "STALLED"
}

function getInsight(
  analysis: AxisSessionAnalysis | null
) {
  if (!analysis) {
    return "Run analysis to reveal possession rhythm."
  }

  if (analysis.tempo_label === "fast") {
    return "Defense reacted late before finish."
  }

  if (analysis.tempo_label === "balanced") {
    return "Possession maintained movement through sequence."
  }

  return "Possession slowed before advantage formed."
}

export default function AxisReplayClient({
  session,
  initialEvents,
}: Props) {
  const videoRef =
    useRef<HTMLVideoElement>(null)

  const [events, setEvents] =
    useState(initialEvents)

  const [saving, setSaving] =
    useState(false)

  const [analyzing, setAnalyzing] =
    useState(false)

  const [analysis, setAnalysis] =
    useState<AxisSessionAnalysis | null>(
      null
    )

  async function addEvent(
    label: string
  ) {
    if (!videoRef.current) return

    try {
      setSaving(true)

      const timeSeconds =
        videoRef.current.currentTime

      const newEvent =
        await createAxisEvent({
          sessionId: session.id,
          label,
          timeSeconds,
        })

      setEvents((prev) => [
        ...prev,
        newEvent,
      ])
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function analyzeSession() {
    try {
      setAnalyzing(true)

      const res = await fetch(
        `/api/analyze/session/${session.id}`,
        {
          method: "POST",
        }
      )

      const data = await res.json()

      if (data.analysis) {
        setAnalysis(data.analysis)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setAnalyzing(false)
    }
  }

  function jumpToEvent(
    time: number
  ) {
    if (!videoRef.current) return

    videoRef.current.currentTime = time

    videoRef.current.play()
  }

  const orderedEvents = useMemo(() => {
    return [...events].sort(
      (a, b) =>
        a.time_seconds -
        b.time_seconds
    )
  }, [events])

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
        <p className="break-all text-xs uppercase tracking-[0.2em] text-neutral-500">
          {session.file_name}
        </p>
      </div>

      <video
        ref={videoRef}
        className="w-full rounded-2xl"
        controls
        playsInline
        src={session.video_url}
      />

      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
          Axis Read
        </p>

        <h2 className="mt-3 text-3xl font-bold uppercase tracking-[0.2em]">
          {getStateLabel(analysis)}
        </h2>

        <div className="mt-8 flex items-center overflow-x-auto text-5xl font-light tracking-[0.5em] text-white">
          {orderedEvents.map(
            (event, index) => (
              <button
                key={event.id}
                onClick={() =>
                  jumpToEvent(
                    event.time_seconds
                  )
                }
                className="transition hover:scale-110"
                style={{
                  marginRight:
                    index ===
                    orderedEvents.length - 1
                      ? "0rem"
                      : Math.max(
                          0.5,
                          Math.min(
                            4,
                            event.time_seconds /
                              8
                          )
                        ) + "rem",
                }}
              >
                {getSymbol(event.label)}
              </button>
            )
          )}
        </div>

        <p className="mt-8 text-sm leading-7 text-neutral-400">
          {getInsight(analysis)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          "PASS",
          "DRIVE",
          "SHOT",
          "STOP",
        ].map((label) => (
          <button
            key={label}
            onClick={() =>
              addEvent(label)
            }
            disabled={saving}
            className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm font-semibold tracking-[0.2em] transition hover:border-white disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>

      <button
        onClick={analyzeSession}
        disabled={
          analyzing ||
          events.length === 0
        }
        className="rounded-xl bg-white p-4 text-sm font-bold uppercase tracking-[0.2em] text-black transition hover:opacity-90 disabled:opacity-40"
      >
        {analyzing
          ? "Analyzing"
          : "Analyze"}
      </button>
    </div>
  )
}