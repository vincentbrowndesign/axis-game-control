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

type ShotForm = {
  time: string
  space: string
  balance: string
  pressure: string
  result: string
}

const defaultShotForm: ShotForm = {
  time: "",
  space: "",
  balance: "",
  pressure: "",
  result: "",
}

function getSymbol(label: string) {
  if (label === "PASS") return "→"
  if (label === "DRIVE") return "⇢"
  if (label === "SHOT") return "●"
  if (label === "TURNOVER") return "×"
  if (label === "STOP") return "×"

  return "•"
}

function getInsight(analysis: AxisSessionAnalysis | null) {
  if (!analysis) {
    return "Tap the possession, then analyze the flow."
  }

  return analysis.summary ?? "Axis read complete."
}

export default function AxisReplayClient({
  session,
  initialEvents,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const [events, setEvents] = useState(initialEvents)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AxisSessionAnalysis | null>(null)

  const [shotOpen, setShotOpen] = useState(false)
  const [shotForm, setShotForm] = useState<ShotForm>(defaultShotForm)

  const orderedEvents = useMemo(() => {
    return [...events].sort((a, b) => a.time_seconds - b.time_seconds)
  }, [events])

  async function addEvent(label: string, note?: string) {
    if (!videoRef.current) return

    try {
      setSaving(true)

      const newEvent = await createAxisEvent({
        sessionId: session.id,
        label,
        timeSeconds: videoRef.current.currentTime,
        note,
      })

      setEvents((prev) => [...prev, newEvent])
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function saveShot() {
    const note = JSON.stringify(shotForm)

    await addEvent("SHOT", note)

    setShotOpen(false)
    setShotForm(defaultShotForm)
  }

  async function analyzeSession() {
    try {
      setAnalyzing(true)

      const res = await fetch(`/api/analyze/session/${session.id}`, {
        method: "POST",
      })

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
          {analysis?.tempo_label ?? "LIVE POSSESSION"}
        </h2>

        <div className="mt-8 flex items-center overflow-x-auto text-5xl font-light tracking-[0.45em] text-white">
          {orderedEvents.map((event) => (
            <button
              key={event.id}
              onClick={() => jumpToEvent(event.time_seconds)}
              className="mr-8 transition hover:scale-110"
            >
              {getSymbol(event.label)}
            </button>
          ))}
        </div>

        <p className="mt-8 text-sm leading-7 text-neutral-400">
          {getInsight(analysis)}
        </p>
      </div>

      {shotOpen && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
            Shot Context
          </p>

          <QuestionGroup
            title="Time"
            value={shotForm.time}
            options={["early", "on time", "late"]}
            onChange={(value) =>
              setShotForm((prev) => ({ ...prev, time: value }))
            }
          />

          <QuestionGroup
            title="Space"
            value={shotForm.space}
            options={["open", "crowded", "cut off"]}
            onChange={(value) =>
              setShotForm((prev) => ({ ...prev, space: value }))
            }
          />

          <QuestionGroup
            title="Balance"
            value={shotForm.balance}
            options={["set", "drifting", "off balance"]}
            onChange={(value) =>
              setShotForm((prev) => ({ ...prev, balance: value }))
            }
          />

          <QuestionGroup
            title="Pressure"
            value={shotForm.pressure}
            options={["clear", "contested", "trapped"]}
            onChange={(value) =>
              setShotForm((prev) => ({ ...prev, pressure: value }))
            }
          />

          <QuestionGroup
            title="Result"
            value={shotForm.result}
            options={["MAKE", "MISS"]}
            onChange={(value) =>
              setShotForm((prev) => ({ ...prev, result: value }))
            }
          />

          <button
            onClick={saveShot}
            disabled={
              saving ||
              !shotForm.time ||
              !shotForm.space ||
              !shotForm.balance ||
              !shotForm.pressure ||
              !shotForm.result
            }
            className="mt-5 w-full rounded-xl bg-white p-4 text-sm font-bold uppercase tracking-[0.2em] text-black disabled:opacity-40"
          >
            Save Shot
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => addEvent("PASS")}
          disabled={saving}
          className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm font-semibold tracking-[0.2em] transition hover:border-white disabled:opacity-50"
        >
          PASS
        </button>

        <button
          onClick={() => addEvent("DRIVE")}
          disabled={saving}
          className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm font-semibold tracking-[0.2em] transition hover:border-white disabled:opacity-50"
        >
          DRIVE
        </button>

        <button
          onClick={() => setShotOpen(true)}
          disabled={saving}
          className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm font-semibold tracking-[0.2em] transition hover:border-white disabled:opacity-50"
        >
          SHOT
        </button>

        <button
          onClick={() => addEvent("TURNOVER")}
          disabled={saving}
          className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm font-semibold tracking-[0.2em] transition hover:border-white disabled:opacity-50"
        >
          TURNOVER
        </button>
      </div>

      <button
        onClick={analyzeSession}
        disabled={analyzing || events.length === 0}
        className="rounded-xl bg-white p-4 text-sm font-bold uppercase tracking-[0.2em] text-black transition hover:opacity-90 disabled:opacity-40"
      >
        {analyzing ? "Analyzing" : "Analyze"}
      </button>
    </div>
  )
}

function QuestionGroup({
  title,
  value,
  options,
  onChange,
}: {
  title: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-neutral-500">
        {title}
      </p>

      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`rounded-lg border p-3 text-xs uppercase tracking-[0.12em] ${
              value === option
                ? "border-white bg-white text-black"
                : "border-neutral-800 bg-black text-neutral-400"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}