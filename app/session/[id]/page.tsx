// app/session/[id]/page.tsx

"use client"

import {
  useEffect,
  useRef,
  useState,
} from "react"

import MuxPlayer from "@mux/mux-player-react"

import MobileVideoUpload from "@/components/MobileVideoUpload"

import { supabase } from "@/lib/supabase"

type AxisEvent = {
  id: string
  label: string
  team: string | null
  timestamp: number
  created_at: string
}

type UploadPayload = {
  playbackId: string
  assetId: string
  uploadId: string
}

export default function SessionPage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const [sessionId, setSessionId] =
    useState<string | null>(null)

  const [playbackId, setPlaybackId] =
    useState<string | null>(null)

  const [events, setEvents] =
    useState<AxisEvent[]>([])

  const [saving, setSaving] =
    useState(false)

  const playerRef = useRef<any>(null)

  // RESOLVE NEXT 15 PARAMS

  useEffect(() => {
    async function resolveParams() {
      const resolved = await params

      setSessionId(resolved.id)
    }

    resolveParams()
  }, [params])

  // LOAD SESSION

  useEffect(() => {
    if (!sessionId) return

    loadSession()
    loadEvents()
  }, [sessionId])

  async function loadSession() {
    if (!sessionId) return

    const { data, error } =
      await supabase
        .from("axis_sessions")
        .select("*")
        .eq("id", sessionId)
        .single()

    if (error) {
      console.error(
        "LOAD SESSION ERROR:",
        error
      )

      return
    }

    if (data?.playback_id) {
      setPlaybackId(
        data.playback_id
      )
    }
  }

  async function loadEvents() {
    if (!sessionId) return

    const { data, error } =
      await supabase
        .from("axis_events")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", {
          ascending: true,
        })

    if (error) {
      console.error(
        "LOAD EVENTS ERROR:",
        error
      )

      return
    }

    if (data) {
      setEvents(data as AxisEvent[])
    }
  }

  async function saveReplay(
    payload: UploadPayload
  ) {
    if (!sessionId) return

    try {
      setSaving(true)

      const { error } =
        await supabase
          .from("axis_sessions")
          .upsert({
            id: sessionId,

            title:
              "Axis Session",

            playback_id:
              payload.playbackId,

            asset_id:
              payload.assetId,

            upload_id:
              payload.uploadId,
          })

      if (error) {
        console.error(
          "SAVE REPLAY ERROR:",
          error
        )

        return
      }

      setPlaybackId(
        payload.playbackId
      )
    } catch (error) {
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  async function addEvent(
    label: string,
    team: string
  ) {
    if (!sessionId) return

    const timestamp =
      playerRef.current
        ?.currentTime ?? 0

    const { data, error } =
      await supabase
        .from("axis_events")
        .insert({
          session_id: sessionId,

          label,

          team,

          timestamp,
        })
        .select()
        .single()

    if (error) {
      console.error(
        "ADD EVENT ERROR:",
        error
      )

      return
    }

    setEvents((prev) => [
      ...prev,
      data as AxisEvent,
    ])
  }

  function seekTo(time: number) {
    if (!playerRef.current)
      return

    playerRef.current.currentTime =
      time

    playerRef.current.play?.()
  }

  return (
    <main className="min-h-screen bg-black p-5 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-4xl font-black tracking-widest">
          AXIS SESSION
        </h1>

        <MobileVideoUpload
          onReady={saveReplay}
        />

        {saving && (
          <p className="text-sm text-zinc-400">
            Saving replay...
          </p>
        )}

        <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
          {playbackId ? (
            <MuxPlayer
              ref={playerRef}
              playbackId={
                playbackId
              }
              streamType="on-demand"
              autoPlay={false}
              className="w-full"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center text-zinc-500">
              Loading replay...
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() =>
              addEvent(
                "SHOT",
                "HOME"
              )
            }
            className="rounded-2xl bg-zinc-900 p-5 font-bold"
          >
            HOME SHOT
          </button>

          <button
            onClick={() =>
              addEvent(
                "SHOT",
                "AWAY"
              )
            }
            className="rounded-2xl bg-zinc-900 p-5 font-bold"
          >
            AWAY SHOT
          </button>

          <button
            onClick={() =>
              addEvent(
                "TURNOVER",
                "HOME"
              )
            }
            className="rounded-2xl bg-zinc-900 p-5 font-bold"
          >
            HOME TOV
          </button>

          <button
            onClick={() =>
              addEvent(
                "TURNOVER",
                "AWAY"
              )
            }
            className="rounded-2xl bg-zinc-900 p-5 font-bold"
          >
            AWAY TOV
          </button>
        </div>

        <section className="rounded-3xl border border-zinc-800 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm tracking-[0.4em] text-zinc-400">
              TIMELINE
            </h2>

            <span className="text-sm text-zinc-500">
              {events.length} events
            </span>
          </div>

          <div className="space-y-2">
            {events.length ===
              0 && (
              <p className="text-center text-zinc-600">
                No events yet
              </p>
            )}

            {events.map((event) => (
              <button
                key={event.id}
                onClick={() =>
                  seekTo(
                    event.timestamp
                  )
                }
                className="flex w-full items-center justify-between rounded-xl bg-zinc-900 px-4 py-3 text-left"
              >
                <div>
                  <p className="font-bold">
                    {event.team}{" "}
                    {event.label}
                  </p>

                  <p className="text-xs text-zinc-500">
                    {event.timestamp.toFixed(
                      1
                    )}
                    s
                  </p>
                </div>

                <span className="text-xs text-zinc-500">
                  PLAY
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}