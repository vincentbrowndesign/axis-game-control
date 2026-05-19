"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { buildActiveTemporalSession } from "@/lib/engine/memoryGeneration"
import { createRun, formatRunTime, type Run } from "@/lib/run/runState"
import { readStoredRun, subscribeTemporalRun } from "@/lib/run/runStore"
import {
  isPositiveSignal,
  signalEventLabel,
  type SignalResult,
} from "@/lib/run/signals"

function pulseTone(side: "home" | "away", result: SignalResult) {
  if (side === "home") {
    return isPositiveSignal(result)
      ? "bg-orange-300 shadow-[0_0_18px_rgba(253,186,116,0.4)]"
      : "border border-orange-300/50 bg-orange-950"
  }

  return isPositiveSignal(result)
    ? "bg-sky-300 shadow-[0_0_18px_rgba(125,211,252,0.4)]"
    : "border border-sky-300/50 bg-sky-950"
}

function sideName(run: Run, side: "home" | "away") {
  return side === "home" ? run.home : run.away
}

export function SequenceConsole({ sequenceId }: { sequenceId: string }) {
  const [run, setRun] = useState<Run>(() => createRun())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (typeof window === "undefined") return

    const read = () => {
      const stored = readStoredRun()

      if (stored) setRun(stored)
    }
    const interval = window.setInterval(() => {
      setNow(Date.now())
      read()
    }, 1000)
    const unsubscribe = subscribeTemporalRun((nextRun) => {
      setRun(nextRun)
      setNow(Date.now())
    })

    read()

    return () => {
      window.clearInterval(interval)
      unsubscribe()
    }
  }, [])

  const session = useMemo(() => buildActiveTemporalSession(run, now), [run, now])
  const selectedStoryBlock = (run.storyBlocks ?? []).find(
    (block) => block.id === sequenceId
  )
  const selectedSequence =
    session.sequences.find((sequence) => sequence.id === sequenceId) ||
    (selectedStoryBlock
      ? session.sequences.find((sequence) =>
          sequence.signals.some((signal) =>
            selectedStoryBlock.signalIds.includes(signal.id)
          )
        )
      : undefined) ||
    session.sequences[0]
  const signals = selectedSequence?.signals.length
    ? selectedSequence.signals
    : selectedStoryBlock?.signalIds.length
      ? session.signals.filter((signal) => selectedStoryBlock.signalIds.includes(signal.id))
      : session.signals

  if (!selectedSequence) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#050505] px-4 text-zinc-100">
        <div className="max-w-sm text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
            Sequence
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.05em]">
            No sequence yet
          </h1>
          <p className="mt-3 text-sm font-bold leading-6 text-zinc-600">
            Tap objective stat events to create the first temporal sequence.
          </p>
          <Link
            href="/tap"
            className="mt-6 inline-grid h-12 place-items-center rounded-full border border-zinc-700 px-5 text-xs font-black uppercase tracking-[0.18em] text-zinc-300"
          >
            Back to Tap
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#050505] px-4 pb-8 pt-4 text-zinc-100 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-4">
        <header className="grid gap-3 border-b border-zinc-900 pb-3">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/tap"
              className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 transition hover:text-zinc-300"
            >
              Tap
            </Link>
            <p className="font-mono text-xs font-black text-emerald-300">
              {formatRunTime(session.runtime)}
            </p>
            <Link
              href="/track"
              className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 transition hover:text-zinc-300"
            >
              Track
            </Link>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <p className="truncate text-xl font-black uppercase leading-none text-orange-200 sm:text-3xl">
              {run.home}
            </p>
            <div className="rounded-full border border-zinc-800 bg-black px-4 py-2 font-mono text-xl font-black text-zinc-100">
              {session.score.home}-{session.score.away}
            </div>
            <p className="truncate text-right text-xl font-black uppercase leading-none text-sky-200 sm:text-3xl">
              {run.away}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 rounded-full border border-zinc-900 bg-black px-3 py-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
              Flow
            </span>
            <span className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
              {session.temporalState.label}
            </span>
          </div>
        </header>

        <section className="grid gap-4 rounded-lg border border-zinc-800 bg-black p-4">
          {selectedStoryBlock ? (
            <div className="relative min-h-[22rem] overflow-hidden rounded-md border border-zinc-900 bg-zinc-950">
              {selectedStoryBlock.media.contentType.startsWith("video/") ? (
                <video
                  src={selectedStoryBlock.media.url}
                  className="absolute inset-0 h-full w-full object-cover opacity-82"
                  controls
                  playsInline
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-cover bg-center opacity-82"
                  style={{
                    backgroundImage: `url(${selectedStoryBlock.media.url})`,
                  }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/20" />
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                <div>
                  <p className="w-fit rounded-full border border-white/12 bg-black/45 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-200 backdrop-blur">
                    {selectedStoryBlock.sticker}
                  </p>
                  <p className="mt-3 text-4xl font-black uppercase tracking-[-0.06em] text-zinc-100">
                    Moment
                  </p>
                </div>
                <p className="font-mono text-2xl font-black text-zinc-100">
                  {selectedStoryBlock.score.home}-{selectedStoryBlock.score.away}
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4">
            <div className="grid content-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
                  Sequence
                </p>
                <h1 className="mt-2 text-4xl font-black uppercase tracking-[-0.05em] text-zinc-100 sm:text-6xl">
                  {selectedStoryBlock?.sticker ||
                    selectedSequence?.title ||
                    session.temporalState.momentum}
                </h1>
                <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-zinc-500">
                  {selectedSequence?.summary || "This moment lives inside the game flow."}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-zinc-900 pt-3">
                <EvidenceNumber label="Signals" value={signals.length} />
                <EvidenceNumber label="Runs" value={session.sequences.length} />
                <EvidenceNumber label="Saved" value={session.memories.length} />
              </div>
            </div>
          </div>

          <div className="relative min-h-28 overflow-hidden rounded-md border border-zinc-900 bg-[#070707] px-4 py-5">
            <div className="absolute left-4 right-4 top-1/2 h-px bg-zinc-800" />
            <div className="relative z-10 flex h-full items-center gap-2 overflow-x-auto">
              {signals.length ? (
                signals.map((signal) => (
                  <span
                    key={signal.id}
                    title={`${sideName(run, signal.side)} ${signalEventLabel(signal)}`}
                    className={`block shrink-0 rounded-full ${pulseTone(signal.side, signal.result)} ${
                      isPositiveSignal(signal.result) ? "h-5 w-5" : "h-3 w-3"
                    }`}
                  />
                ))
              ) : (
                <span className="h-1 w-full rounded-full bg-zinc-900" />
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
            Runs
          </p>
          <div className="flex gap-3 overflow-x-auto">
            {session.sequences.length ? (
              session.sequences.map((sequence) => (
                <article
                  key={sequence.id}
                  className="min-w-60 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"
                >
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                    {sequence.label}
                  </p>
                  <p className="mt-4 truncate text-xl font-black uppercase tracking-[-0.04em] text-zinc-100">
                    {sequence.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-zinc-600">
                    {sequence.summary}
                  </p>
                </article>
              ))
            ) : (
              <div className="min-w-full rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="text-sm font-black uppercase tracking-[0.16em] text-zinc-500">
                  The next run will show here.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function EvidenceNumber({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-700">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-black text-zinc-200">{value}</p>
    </div>
  )
}
