"use client"

import { useRef, useState } from "react"

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

export default function AxisReplayClient({
  session,
  initialEvents,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const [events, setEvents] = useState(initialEvents)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] =
    useState<AxisSessionAnalysis | null>(null)

  async function addEvent(label: string) {
    if (!videoRef.current) return

    try {
      setSaving(true)

      const timeSeconds = videoRef.current.currentTime

      const newEvent = await createAxisEvent({
        sessionId: session.id,
        label,
        timeSeconds,
      })

      setEvents((prev) => [...prev, newEvent])
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

  function jumpToEvent(time: number) {
    if (!videoRef.current) return

    videoRef.current.currentTime = time
    videoRef.current.play()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
        <p className="break-all text-sm uppercase tracking-[0.2em] text-neutral-400">
          {session.file_name}
        </p>

        <p className="mt-2 text-xs text-neutral-600">
          {new Date(session.created_at).toLocaleString()}
        </p>
      </div>

      <video
        ref={videoRef}
        className="w-full rounded-2xl"
        controls
        playsInline
        src={session.video_url}
      />

      <div className="grid grid-cols-2 gap-3">
        {["SHOT", "DRIVE", "PASS", "STOP"].map(
          (label) => (
            <button
              key={label}
              onClick={() => addEvent(label)}
              disabled={saving}
              className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm font-semibold tracking-[0.2em] transition hover:border-white disabled:opacity-50"
            >
              {label}
            </button>
          )
        )}
      </div>

      <button
        onClick={analyzeSession}
        disabled={analyzing || events.length === 0}
        className="rounded-xl border border-neutral-700 bg-white p-4 text-sm font-bold uppercase tracking-[0.2em] text-black disabled:opacity-40"
      >
        {analyzing ? "Analyzing" : "Analyze Session"}
      </button>

      {analysis && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Axis Read
          </p>

          <p className="mt-3 text-lg font-semibold uppercase tracking-[0.15em]">
            {analysis.tempo_label}
          </p>

          <p className="mt-3 text-sm leading-6 text-neutral-400">
            {analysis.summary}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-neutral-400">
            <div>Events: {analysis.event_count}</div>
            <div>Avg Gap: {analysis.average_gap_seconds}s</div>
            <div>Passes: {analysis.pass_count}</div>
            <div>Drives: {analysis.drive_count}</div>
            <div>Shots: {analysis.shot_count}</div>
            <div>Stops: {analysis.stop_count}</div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {[...events]
          .sort((a, b) => a.time_seconds - b.time_seconds)
          .map((event) => (
            <button
              key={event.id}
              onClick={() =>
                jumpToEvent(event.time_seconds)
              }
              className="flex items-center justify-between rounded-xl border border-neutral-900 bg-neutral-950 p-4 text-left transition hover:border-neutral-700"
            >
              <span className="font-semibold tracking-[0.15em]">
                {event.label}
              </span>

              <span className="text-sm text-neutral-500">
                {event.time_seconds.toFixed(1)}s
              </span>
            </button>
          ))}
      </div>
    </div>
  )
}