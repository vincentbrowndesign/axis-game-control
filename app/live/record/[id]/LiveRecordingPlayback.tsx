"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { type LiveArchiveSession, loadArchivedRecording } from "@/lib/liveArchive"

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
    <main className="min-h-dvh bg-black text-zinc-100">
      <section className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-4 sm:px-6">
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

        {!hydrated ? (
          <div className="grid flex-1 place-items-center text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">
              Loading recording
            </p>
          </div>
        ) : null}

        {hydrated && !session ? (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">
                RECORDING NOT FOUND
              </p>
              <Link
                href="/live"
                className="mt-7 inline-flex border border-white/10 bg-zinc-100 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black"
              >
                Return live
              </Link>
            </div>
          </div>
        ) : null}

        {session ? (
          <div className="flex flex-1 flex-col justify-center gap-5 py-6">
            <div className="overflow-hidden border border-white/10 bg-zinc-950">
              <video
                src={session.playbackUrl}
                controls
                playsInline
                className="aspect-video w-full bg-black object-contain"
              />
            </div>

            <div className="grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
                  Archived recording
                </p>
                <p className="mt-2 font-mono text-4xl font-black leading-none text-zinc-100">
                  {formatClock(session.duration)}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                  Created
                </p>
                <p className="mt-1 text-sm font-bold uppercase tracking-[0.12em] text-zinc-200">
                  {formatDate(session.createdAt)}
                </p>
                <a
                  href={session.playbackUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-100"
                >
                  Open file
                </a>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}
