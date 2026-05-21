"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { type LiveArchiveSession, loadArchivedRecording } from "@/lib/liveArchive"
import {
  AxisPage,
  AxisReplayFrame,
} from "@/components/axis/AxisPrimitives"

function formatClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export function LiveRecordingPlayback({ id }: { id: string }) {
  const [session, setSession] = useState<LiveArchiveSession | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSession(loadArchivedRecording(id))
      setHydrated(true)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [id])

  return (
    <AxisPage max="max-w-6xl" className="axis-replay-operating-room" mode="REPLAY" telemetry="Archived memory">
        {!hydrated ? (
          <div className="grid flex-1 place-items-center text-center">
            <p className="axis-sync-muted text-[11px] font-black uppercase tracking-[0.24em]">
              Gathering recording
            </p>
          </div>
        ) : null}

        {hydrated && !session ? (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <p className="axis-sync-muted text-[11px] font-black uppercase tracking-[0.28em]">
                MEMORY NOT FOUND
              </p>
              <Link
                href="/live"
                className="axis-sync-action mt-7 inline-flex px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em]"
              >
                Return live
              </Link>
            </div>
          </div>
        ) : null}

        {session ? (
          <div className="flex flex-1 flex-col justify-center gap-5 py-6">
            <AxisReplayFrame>
              <video
                src={session.playbackUrl}
                controls
                playsInline
                className="axis-replay-surface aspect-video w-full object-contain"
              />
            </AxisReplayFrame>

            <div className="grid gap-4 border-t pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <p className="axis-world-kicker text-[10px] font-black uppercase tracking-[0.24em]">
                  Archived memory
                </p>
                <p className="axis-world-title mt-2 font-mono text-4xl font-black leading-none">
                  {formatClock(session.duration)}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="axis-sync-muted text-[10px] font-black uppercase tracking-[0.2em]">
                  Created
                </p>
                <p className="axis-sync-text mt-1 text-sm font-bold uppercase tracking-[0.12em]">
                  {formatDate(session.createdAt)}
                </p>
                <a
                  href={session.playbackUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="axis-sync-action mt-4 inline-flex px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em]"
                >
                  Open file
                </a>
              </div>
            </div>
          </div>
        ) : null}
    </AxisPage>
  )
}
