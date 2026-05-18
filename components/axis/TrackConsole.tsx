"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { buildActiveTemporalSession } from "@/lib/engine/memoryGeneration"
import type { TemporalMoment } from "@/lib/engine/momentDetection"
import { runTemporalEngine } from "@/lib/engine/temporalEngine"
import { createRun, elapsedRunMs, formatRunTime, type Run } from "@/lib/run/runState"
import { readStoredRun, subscribeTemporalRun, writeStoredRun } from "@/lib/run/runStore"
import type { RunSignal, SignalSide } from "@/lib/run/signals"

type TrackMoment = Pick<
  TemporalMoment,
  "id" | "label" | "name" | "summary" | "start" | "end" | "signalIds"
>

type TrackInference = {
  moments: TrackMoment[]
  source: "local" | "openai"
}

function sideName(run: Run, side: SignalSide | "neutral") {
  if (side === "home") return run.home
  if (side === "away") return run.away

  return "Flow"
}

function seconds(value: number) {
  return `${Math.max(0, Math.round(value / 1000))}s`
}

function signalColor(signal: RunSignal) {
  if (signal.side === "home") {
    return signal.result === "make"
      ? "bg-orange-300 shadow-[0_0_24px_rgba(253,186,116,0.44)]"
      : "border border-orange-300/50 bg-orange-950"
  }

  return signal.result === "make"
    ? "bg-sky-300 shadow-[0_0_24px_rgba(125,211,252,0.44)]"
    : "border border-sky-300/50 bg-sky-950"
}

function labelTone(label: string) {
  if (label === "COLD") return "text-sky-200"
  if (label === "SPURT") return "text-orange-200"
  if (label === "SWING") return "text-emerald-200"
  if (label === "HOT") return "text-orange-300"

  return "text-zinc-300"
}

function positionFor(time: number, totalMs: number) {
  if (totalMs <= 0) return 0

  return Math.max(0, Math.min(100, (time / totalMs) * 100))
}

function momentWidth(moment: TrackMoment, totalMs: number) {
  const start = positionFor(moment.start, totalMs)
  const end = positionFor(moment.end, totalMs)

  return Math.max(5, end - start)
}

function fallbackMoments(temporalMoments: TemporalMoment[]): TrackMoment[] {
  return temporalMoments.map((moment) => ({
    id: moment.id,
    label: moment.label,
    name: moment.name,
    summary: moment.summary,
    start: moment.start,
    end: moment.end,
    signalIds: moment.signalIds,
  }))
}

export function TrackConsole() {
  const [run, setRun] = useState<Run>(() => createRun())
  const [now, setNow] = useState(() => Date.now())
  const [trackInference, setTrackInference] = useState<TrackInference | null>(null)
  const runSnapshotRef = useRef("")

  useEffect(() => {
    if (typeof window === "undefined") return

    const read = () => {
      const stored = readStoredRun()

      if (!stored) return

      const snapshot = JSON.stringify(stored)

      if (snapshot === runSnapshotRef.current) return

      runSnapshotRef.current = snapshot
      setRun(stored)
    }
    const interval = window.setInterval(() => {
      setNow(Date.now())
      read()
    }, 1000)
    const unsubscribe = subscribeTemporalRun((nextRun) => {
      runSnapshotRef.current = JSON.stringify(nextRun)
      setRun(nextRun)
      setNow(Date.now())
    })

    read()

    return () => {
      window.clearInterval(interval)
      unsubscribe()
    }
  }, [])

  const elapsedMs = elapsedRunMs(run, now)
  const elapsed = formatRunTime(elapsedMs)
  const temporal = useMemo(() => runTemporalEngine(run, now), [run, now])
  const session = useMemo(() => buildActiveTemporalSession(run, now), [run, now])
  const localMoments = useMemo(() => fallbackMoments(temporal.moments), [temporal.moments])
  const signalSignature = useMemo(
    () =>
      run.signals
        .map((signal) => `${signal.id}:${signal.side}:${signal.result}:${signal.time}`)
        .join("|"),
    [run.signals]
  )

  useEffect(() => {
    if (typeof window === "undefined") return

    if (run.signals.length < 3) return

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        const apiMoments = fallbackMoments(runTemporalEngine(run, Date.now()).moments)
        const response = await fetch("/api/infer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "track",
            run: {
              id: run.id,
              home: run.home,
              away: run.away,
              startedAt: run.startedAt,
              pausedMs: run.pausedMs ?? 0,
            },
            signals: run.signals.map((signal, index) => ({
              id: signal.id,
              side: signal.side,
              result: signal.result,
              time: signal.time,
              order: index + 1,
              interval: index > 0 ? signal.time - run.signals[index - 1].time : 0,
            })),
            moments: apiMoments,
          }),
          signal: controller.signal,
        })

        if (!response.ok) return

        const data = (await response.json()) as {
          track?: {
            moments?: TrackMoment[]
            source?: "local" | "openai"
          }
        }
        const moments = Array.isArray(data.track?.moments)
          ? data.track.moments
          : apiMoments

        setTrackInference({
          moments,
          source: data.track?.source === "openai" ? "openai" : "local",
        })
      } catch (error) {
        if (!controller.signal.aborted) console.error(error)
      }
    }, 900)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [
    run,
    signalSignature,
  ])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!run.media?.url || run.audioContext) return
    if (!/^https?:\/\//i.test(run.media.url)) return

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/deepgram", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mediaUrl: run.media?.url,
          }),
          signal: controller.signal,
        })

        if (!response.ok) return

        const data = (await response.json()) as {
          audioContext?: Run["audioContext"] | null
        }

        if (!data.audioContext) return

        setRun((current) => {
          const next = {
            ...current,
            audioContext: data.audioContext ?? undefined,
          }

          writeStoredRun(next)

          return next
        })
      } catch (error) {
        if (!controller.signal.aborted) console.error(error)
      }
    }, 1000)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [run.audioContext, run.media?.url])

  const activeInference = run.signals.length >= 3 ? trackInference : null
  const moments = activeInference?.moments.length ? activeInference.moments : localMoments
  const homeScore = session.score.home
  const awayScore = session.score.away
  const timelineMs = Math.max(
    elapsedMs,
    run.signals[run.signals.length - 1]?.time ?? 0,
    60_000
  )
  const activeMoment = moments[0]
  const recentSignals = run.signals.slice(-36)
  const source = activeInference?.source === "openai" ? "AI" : "LOCAL"

  return (
    <main className="min-h-screen overflow-hidden bg-[#050505] px-4 pb-8 pt-4 text-zinc-100 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-4">
        <header className="grid gap-3 border-b border-zinc-900 pb-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-300/60">
                Source
              </p>
              <p className="truncate text-xl font-black uppercase leading-none text-orange-200 sm:text-3xl">
                {run.home}
              </p>
            </div>

            <div className="grid justify-items-center gap-1">
              <div className="rounded-full border border-zinc-800 bg-black px-4 py-2 font-mono text-xl font-black text-zinc-100 sm:text-2xl">
                {homeScore}-{awayScore}
              </div>
              <div className="rounded-full border border-zinc-900 bg-zinc-950 px-3 py-1 font-mono text-[11px] font-black text-emerald-300">
                {elapsed}
              </div>
            </div>

            <div className="min-w-0 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300/60">
                Source
              </p>
              <p className="truncate text-xl font-black uppercase leading-none text-sky-200 sm:text-3xl">
                {run.away}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Link
              href="/tap"
              className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 transition hover:text-zinc-300"
            >
              Tap
            </Link>
            <div className="flex min-w-0 items-center gap-2">
              <span className={`text-xs font-black uppercase tracking-[0.2em] ${labelTone(temporal.state.label)}`}>
                {temporal.state.label}
              </span>
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              <span className="truncate text-xs font-bold text-zinc-600">
                {sideName(run, temporal.state.side)}
              </span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-700">
              {source}
            </span>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-lg border border-zinc-800 bg-black">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-500/40 to-transparent" />
          <div className="grid min-h-[30rem] grid-rows-[auto_1fr_auto] gap-4 p-4 sm:min-h-[34rem] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
                Behavioral Timeline
              </p>
              <p className="font-mono text-[10px] font-black text-zinc-600">
                {run.signals.length} SIGNALS
              </p>
            </div>

            <div className="relative overflow-hidden rounded-md border border-zinc-900 bg-[#070707]">
              <div className="absolute inset-x-5 top-1/2 h-px -translate-y-1/2 bg-zinc-800" />
              <div className="absolute inset-y-8 left-5 w-px bg-zinc-900" />
              <div className="absolute inset-y-8 right-5 w-px bg-zinc-900" />
              <div className="absolute left-5 right-5 top-[42%] h-px bg-orange-300/10" />
              <div className="absolute left-5 right-5 top-[58%] h-px bg-sky-300/10" />
              <p className="absolute left-5 top-[calc(42%-1.7rem)] text-[10px] font-black uppercase tracking-[0.2em] text-orange-300/40">
                {run.home}
              </p>
              <p className="absolute left-5 top-[calc(58%+0.8rem)] text-[10px] font-black uppercase tracking-[0.2em] text-sky-300/40">
                {run.away}
              </p>

              {moments.map((moment, index) => {
                const left = positionFor(moment.start, timelineMs)
                const width = momentWidth(moment, timelineMs)

                return (
                  <span
                    key={`${moment.id}-strip`}
                    className="absolute h-8 rounded-full border border-zinc-700/60 bg-zinc-900/80"
                    style={{
                      left: `${left}%`,
                      top: `${28 + index * 20}px`,
                      width: `${width}%`,
                    }}
                    title={`${moment.name}: ${moment.summary}`}
                  />
                )
              })}

              {run.signals.map((signal) => {
                const left = positionFor(signal.time, timelineMs)
                const top = signal.side === "home" ? "42%" : "58%"

                return (
                  <span
                    key={signal.id}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${signalColor(signal)} ${
                      signal.result === "make" ? "h-5 w-5" : "h-3 w-3"
                    }`}
                    style={{ left: `${left}%`, top }}
                    title={`${sideName(run, signal.side)} ${signal.result === "make" ? "+" : "-"} ${seconds(signal.time)}`}
                  />
                )
              })}

              {!run.signals.length ? (
                <div className="grid h-full min-h-80 place-items-center px-5 text-center">
                  <div>
                    <p className="text-3xl font-black uppercase tracking-[-0.04em] text-zinc-300">
                      Awaiting Signals
                    </p>
                    <p className="mt-2 text-sm font-bold text-zinc-600">
                      + and - signals from Tap appear here.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="absolute inset-x-5 bottom-6 grid grid-cols-3 font-mono text-[10px] font-black text-zinc-700">
                <span>00:00</span>
                <span className="text-center">{formatRunTime(timelineMs / 2)}</span>
                <span className="text-right">{formatRunTime(timelineMs)}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
              <div className="min-w-0 rounded-md border border-zinc-900 bg-zinc-950/70 px-4 py-3">
                <p className={`text-3xl font-black uppercase tracking-[-0.04em] ${labelTone(activeMoment?.label || temporal.state.label)}`}>
                  {activeMoment?.name || temporal.state.momentum}
                </p>
                <p className="mt-1 truncate text-sm font-bold text-zinc-600">
                  {activeMoment?.summary || temporal.state.interpretation}
                </p>
              </div>

              <div className="flex items-center gap-1.5 overflow-hidden rounded-md border border-zinc-900 bg-zinc-950/70 px-3 py-3">
                {recentSignals.length ? (
                  recentSignals.map((signal) => (
                    <span
                      key={`${signal.id}-recent`}
                      className={`block shrink-0 rounded-full ${signalColor(signal)} ${
                        signal.result === "make" ? "h-3.5 w-3.5" : "h-2 w-2"
                      }`}
                      title={`${sideName(run, signal.side)} ${signal.result === "make" ? "+" : "-"}`}
                    />
                  ))
                ) : (
                  <span className="h-1 w-full rounded-full bg-zinc-900" />
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
              Generated Moments
            </p>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-700">
              {activeInference?.source === "openai" ? "OpenAI" : "Temporal"}
            </p>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-4">
            <div className="absolute left-4 right-4 top-1/2 h-px bg-zinc-800" />
            {moments.length ? (
              <div className="flex gap-8 overflow-x-auto pb-1">
                {moments.map((moment) => (
                  <article
                  key={moment.id}
                    className="relative min-w-56 bg-transparent py-2"
                  >
                    <span
                      className={`absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-zinc-700 bg-black ${
                        moment.label === "SPURT"
                          ? "shadow-[0_0_18px_rgba(253,186,116,0.34)]"
                          : moment.label === "SWING"
                            ? "shadow-[0_0_18px_rgba(110,231,183,0.28)]"
                            : ""
                      }`}
                    />
                    <p className={`ml-7 text-xs font-black uppercase tracking-[0.18em] ${labelTone(moment.label)}`}>
                      {moment.label} / {seconds(moment.end)}
                    </p>
                    <p className="ml-7 mt-5 truncate text-xl font-black uppercase tracking-[-0.04em] text-zinc-100">
                      {moment.name}
                    </p>
                    <p className="ml-7 mt-1 line-clamp-2 text-sm font-bold leading-5 text-zinc-600">
                      {moment.summary}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="relative z-10">
                <p className="text-sm font-black uppercase tracking-[0.16em] text-zinc-500">
                  Signals will cluster into moments here.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
