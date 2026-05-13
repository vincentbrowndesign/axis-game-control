"use client"

import { useRef, useState } from "react"

import {
  AxisEvent,
  AxisSession,
  createAxisEvent,
} from "@/lib/axisSessions"

type Props = {
  session: AxisSession
  initialEvents: AxisEvent[]
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

  function jumpToEvent(
    time: number
  ) {
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
          {new Date(
            session.created_at
          ).toLocaleString()}
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
        {[
          "SHOT",
          "DRIVE",
          "PASS",
          "STOP",
        ].map((label) => (
          <button
            key={label}
            onClick={() =>
              addEvent(label)
            }
            disabled={saving}
            className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm font-semibold tracking-[0.2em] transition hover:border-white"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {events
          .sort(
            (a, b) =>
              a.time_seconds -
              b.time_seconds
          )
          .map((event) => (
            <button
              key={event.id}
              onClick={() =>
                jumpToEvent(
                  event.time_seconds
                )
              }
              className="flex items-center justify-between rounded-xl border border-neutral-900 bg-neutral-950 p-4 text-left transition hover:border-neutral-700"
            >
              <span className="font-semibold tracking-[0.15em]">
                {event.label}
              </span>

              <span className="text-sm text-neutral-500">
                {event.time_seconds.toFixed(
                  1
                )}
                s
              </span>
            </button>
          ))}
      </div>
    </div>
  )
}