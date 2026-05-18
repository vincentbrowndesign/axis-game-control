"use client"

import { useEffect, useMemo, useState } from "react"
import { runTemporalEngine } from "@/lib/engine/temporalEngine"
import { createRun, elapsedRunMs, formatRunTime, type Run } from "@/lib/run/runState"
import { activeRunKey, readStoredRun } from "@/lib/run/runStore"
import type { RunSignal } from "@/lib/run/signals"

function signalTone(signal: RunSignal) {
  if (signal.side === "home") {
    return signal.result === "make"
      ? "bg-orange-300"
      : "border border-orange-400/40 bg-orange-950"
  }

  return signal.result === "make"
    ? "bg-sky-300"
    : "border border-sky-400/40 bg-sky-950"
}

function sideName(run: Run, side: "home" | "away" | "neutral") {
  if (side === "home") return run.home
  if (side === "away") return run.away

  return "Flow"
}

function seconds(value: number) {
  return `${Math.max(0, Math.round(value / 1000))}s`
}

export function TrackConsole() {
  const [run, setRun] = useState<Run>(() => createRun())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (typeof window === "undefined") return

    const read = () => {
      const stored = readStoredRun()

      if (stored) setRun(stored)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === activeRunKey) read()
    }
    const interval = window.setInterval(() => {
      setNow(Date.now())
      read()
    }, 1000)

    read()
    window.addEventListener("storage", onStorage)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const elapsed = formatRunTime(elapsedRunMs(run, now))
  const temporal = useMemo(() => runTemporalEngine(run, now), [run, now])
  const recent = run.signals.slice(-28)
  const activeMoment = temporal.moments[0]

  return (
    <main className="min-h-screen bg-[#050505] px-4 pb-10 pt-5 text-zinc-100 sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-5">
        <header className="grid gap-3 border-b border-zinc-800 pb-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
              Axis Track
            </p>
            <p className="font-mono text-sm font-black text-emerald-300">{elapsed}</p>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <p className="truncate text-3xl font-black uppercase leading-none text-orange-300">
              {run.home}
            </p>
            <p className="rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-center text-sm font-black uppercase tracking-[0.2em] text-zinc-300">
              {temporal.state.label}
            </p>
            <p className="truncate text-right text-3xl font-black uppercase leading-none text-sky-300">
              {run.away}
            </p>
          </div>
        </header>

        <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/70">
          <div className="grid min-h-52 place-items-center bg-black">
            <div className="grid justify-items-center gap-3 px-6 text-center">
              <p className="text-5xl font-black uppercase tracking-[-0.04em] text-zinc-100">
                {activeMoment?.name || temporal.state.momentum}
              </p>
              <p className="max-w-md text-sm font-bold leading-6 text-zinc-500">
                {activeMoment?.summary || temporal.state.interpretation}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
              Timeline
            </p>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
              {run.signals.length} signals
            </p>
          </div>
          <div className="flex min-h-10 items-center gap-1.5 overflow-hidden">
            {recent.length ? (
              recent.map((signal) => (
                <span
                  key={signal.id}
                  className={`block rounded-full ${
                    signal.result === "make" ? "h-4 w-4" : "h-2.5 w-2.5"
                  } ${signalTone(signal)}`}
                  title={`${signal.side} ${signal.result} ${seconds(signal.time)}`}
                />
              ))
            ) : (
              <span className="h-1 w-full rounded-full bg-zinc-900" />
            )}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <TrackMetric
            label="Density"
            value={`${Math.round(temporal.analysis.signalDensity * 100)}%`}
          />
          <TrackMetric
            label="Continuity"
            value={`${Math.round(temporal.analysis.continuity * 100)}%`}
          />
          <TrackMetric
            label="Drought"
            value={seconds(temporal.analysis.currentDroughtMs)}
          />
        </section>

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
              Moments
            </p>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
              {sideName(run, temporal.state.side)}
            </p>
          </div>
          <div className="grid gap-2">
            {temporal.moments.length ? (
              temporal.moments.map((moment) => (
                <div
                  key={moment.id}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3"
                >
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                    {moment.label}
                  </p>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black uppercase text-zinc-100">
                      {moment.name}
                    </p>
                    <p className="truncate text-xs font-bold text-zinc-600">
                      {moment.summary}
                    </p>
                  </div>
                  <p className="font-mono text-xs font-black text-zinc-500">
                    {seconds(moment.end)}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-4">
                <p className="text-sm font-black uppercase tracking-[0.16em] text-zinc-500">
                  Awaiting sequence
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function TrackMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-black leading-none text-zinc-100">
        {value}
      </p>
    </div>
  )
}
