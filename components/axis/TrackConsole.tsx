"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { buildActiveTemporalSession } from "@/lib/engine/memoryGeneration"
import type { TemporalMoment } from "@/lib/engine/momentDetection"
import { runTemporalEngine } from "@/lib/engine/temporalEngine"
import {
  createRun,
  elapsedRunMs,
  formatRunTime,
  type Run,
  type RunPlayer,
} from "@/lib/run/runState"
import { readStoredRun, subscribeTemporalRun, writeStoredRun } from "@/lib/run/runStore"
import {
  isPositiveSignal,
  signalEventLabel,
  type RunSignal,
  type SignalSide,
} from "@/lib/run/signals"

type TrackMoment = Omit<
  Pick<TemporalMoment, "id" | "name" | "summary" | "start" | "end" | "signalIds">,
  never
> & {
  label: string
}

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
    return isPositiveSignal(signal.result)
      ? "border-orange-200 bg-orange-300 shadow-[0_0_26px_rgba(253,186,116,0.5)]"
      : "border-orange-300/45 bg-orange-950 shadow-[0_0_14px_rgba(251,146,60,0.12)]"
  }

  return isPositiveSignal(signal.result)
    ? "border-sky-200 bg-sky-300 shadow-[0_0_26px_rgba(125,211,252,0.5)]"
    : "border-sky-300/45 bg-sky-950 shadow-[0_0_14px_rgba(56,189,248,0.12)]"
}

function labelTone(label: string) {
  if (label === "COLD") return "text-sky-200"
  if (label === "BREAK") return "text-red-300"
  if (label === "RECOVERY") return "text-emerald-200"
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

function playerLabel(players: RunPlayer[], playerId?: string) {
  const player = players.find((item) => item.id === playerId)

  if (!player) return null

  return player.name ? `#${player.number} ${player.name}` : `#${player.number}`
}

function audioEnergyAt(run: Run, time: number) {
  const context = run.audioContext
  if (!context) return 0

  const segment = context.speechSegments.find(
    (item) => time >= item.start * 1000 && time <= item.end * 1000
  )

  if (!segment) return 0

  return Math.max(0.18, Math.min(1, segment.confidence + context.escalation * 0.35))
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
              polarity: signal.polarity,
              stat: signal.stat,
              playerId: signal.playerId,
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
  const detailSignals = run.signals.slice(-12).reverse()
  const supportingSignals = activeMoment
    ? run.signals.filter((signal) => activeMoment.signalIds.includes(signal.id)).slice(0, 6)
    : run.signals.slice(-6)
  const detailClusters = useMemo(() => {
    const clustered = moments
      .slice(0, 4)
      .map((moment) => ({
        id: moment.id,
        label: moment.label,
        title: moment.name,
        signals: run.signals.filter((signal) => moment.signalIds.includes(signal.id)),
      }))
      .filter((cluster) => cluster.signals.length)

    if (clustered.length) return clustered

    return detailSignals.length
      ? [
          {
            id: "recent-flow",
            label: "FLOW",
            title: "Recent Flow",
            signals: [...detailSignals].reverse(),
          },
        ]
      : []
  }, [detailSignals, moments, run.signals])
  return (
    <main className="axis-shell min-h-screen overflow-hidden px-4 pb-8 pt-4 text-zinc-100 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-4">
        <header className="grid gap-3 border-b border-zinc-900/90 pb-3">
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
            <div className="flex items-center gap-2">
              <Link
                href="/review"
                className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 transition hover:text-zinc-300"
              >
                Review
              </Link>
            </div>
          </div>
          <div className="axis-glass flex items-center justify-center gap-3 rounded-full px-3 py-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
              Flow
            </span>
            <span className={`text-xs font-black uppercase tracking-[0.18em] ${labelTone(temporal.system.label)}`}>
              {temporal.system.label}
            </span>
            <span className="font-mono text-xs font-black text-zinc-500">
              {Math.round(temporal.system.netValue) > 0 ? "+" : ""}
              {Math.round(temporal.system.netValue)}
            </span>
          </div>
        </header>

        <section className="axis-panel relative overflow-hidden rounded-lg shadow-[0_18px_80px_rgba(0,0,0,0.36)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-400/40 to-transparent" />
          <div className="grid min-h-[36rem] grid-rows-[auto_1fr_auto] gap-4 p-4 sm:min-h-[40rem] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
                Flow
              </p>
              <div className="flex items-center gap-2">
                {run.audioContext ? (
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-950/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300/70">
                    Audio
                  </span>
                ) : null}
                <p className="font-mono text-[10px] font-black text-zinc-600">
                  {run.signals.length}
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-md border border-zinc-900 bg-[#070707]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(39,39,42,0.28),transparent_44%)]" />
              <div className="absolute inset-x-5 top-1/2 h-px -translate-y-1/2 bg-zinc-800/80" />
              <div className="absolute inset-y-8 left-5 w-px bg-zinc-900" />
              <div className="absolute inset-y-8 right-5 w-px bg-zinc-900" />
              <div className="absolute left-5 right-5 top-[38%] h-px bg-orange-300/12" />
              <div className="absolute left-5 right-5 top-[62%] h-px bg-sky-300/12" />
              <p className="absolute left-5 top-[calc(38%-1.7rem)] text-[10px] font-black uppercase tracking-[0.2em] text-orange-300/40">
                {run.home}
              </p>
              <p className="absolute left-5 top-[calc(62%+0.8rem)] text-[10px] font-black uppercase tracking-[0.2em] text-sky-300/40">
                {run.away}
              </p>

              {run.audioContext ? (
                <div className="absolute inset-x-5 top-1/2 flex h-16 -translate-y-1/2 items-center gap-1 opacity-45">
                  {Array.from({ length: 42 }).map((_, index) => {
                    const time = (timelineMs / 41) * index
                    const energy = audioEnergyAt(run, time)

                    return (
                      <span
                        key={`audio-${index}`}
                        className="w-full rounded-full bg-emerald-300/30"
                        style={{
                          height: `${Math.max(2, energy * 54)}px`,
                          opacity: energy ? 0.35 + energy * 0.45 : 0.08,
                        }}
                      />
                    )
                  })}
                </div>
              ) : null}

              {activeMoment ? (() => {
                const left = positionFor(activeMoment.start, timelineMs)
                const width = momentWidth(activeMoment, timelineMs)

                return (
                  <span
                    key={`${activeMoment.id}-active-strip`}
                    className="absolute h-9 rounded-full border border-zinc-500/45 bg-zinc-950/90 shadow-[0_0_28px_rgba(244,244,245,0.12)]"
                    style={{
                      left: `${left}%`,
                      top: "24px",
                      width: `${width}%`,
                    }}
                    title={`${activeMoment.name}: ${activeMoment.summary}`}
                  >
                    <span className={`absolute -top-5 left-2 text-[9px] font-black uppercase tracking-[0.18em] ${labelTone(activeMoment.label)}`}>
                      {activeMoment.label}
                    </span>
                  </span>
                )
              })() : null}

              {run.signals.map((signal) => {
                const left = positionFor(signal.time, timelineMs)
                const top = signal.side === "home" ? "38%" : "62%"
                const labelTop = signal.side === "home" ? "-1.6rem" : "1.05rem"
                const eventPlayer = playerLabel(run.players, signal.playerId)

                return (
                  <span
                    key={signal.id}
                    className="group absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${left}%`, top }}
                    title={`${sideName(run, signal.side)} ${signalEventLabel(signal)} ${seconds(signal.time)}`}
                  >
                    <span
                      className={`block rounded-full border transition group-hover:scale-110 ${signalColor(signal)} ${
                        isPositiveSignal(signal.result) ? "h-5 w-5" : "h-3 w-3"
                      }`}
                    />
                    <span
                      className={`absolute left-1/2 min-w-14 -translate-x-1/2 whitespace-nowrap rounded-full border border-zinc-800 bg-black/80 px-2 py-1 text-center font-mono text-[9px] font-black text-zinc-300 opacity-80 backdrop-blur transition group-hover:border-zinc-500 group-hover:opacity-100`}
                      style={{ top: labelTop }}
                    >
                      {signalEventLabel(signal)}
                    </span>
                    {eventPlayer ? (
                      <span
                        className="absolute left-1/2 hidden min-w-12 -translate-x-1/2 whitespace-nowrap rounded-full bg-zinc-950 px-2 py-1 text-center text-[9px] font-bold text-zinc-500 group-hover:block"
                        style={{ top: signal.side === "home" ? "-3.05rem" : "2.55rem" }}
                      >
                        {eventPlayer}
                      </span>
                    ) : null}
                  </span>
                )
              })}

              {!run.signals.length ? (
                <div className="grid h-full min-h-80 place-items-center px-5 text-center">
                  <div>
                    <p className="text-3xl font-black uppercase tracking-[-0.04em] text-zinc-300">
                      Waiting
                    </p>
                    <p className="mt-2 text-sm font-bold text-zinc-600">
                      Tap + or -.
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

            <div className="grid gap-3 sm:grid-cols-[1.05fr_0.95fr]">
              <div className="axis-glass min-w-0 rounded-md px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${labelTone(activeMoment?.label || temporal.state.label)}`}>
                      {activeMoment?.label || temporal.state.label}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-zinc-700" />
                    <span className="font-mono text-[10px] font-black text-zinc-600">
                      {activeMoment ? seconds(activeMoment.end) : elapsed}
                    </span>
                  </div>
                  <Link
                    href={`/report/${activeMoment?.id || "live"}`}
                    className="shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600 transition hover:text-zinc-300"
                  >
                    Report
                  </Link>
                </div>
                <p className={`mt-2 truncate text-3xl font-black uppercase tracking-[-0.04em] ${labelTone(activeMoment?.label || temporal.state.label)}`}>
                  {activeMoment?.name || temporal.state.momentum}
                </p>
                <p className="mt-1 truncate text-sm font-bold text-zinc-600">
                  {activeMoment?.summary || temporal.state.interpretation}
                </p>
              </div>

              <div className="axis-glass min-w-0 rounded-md px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                  Sequence
                </p>
                {supportingSignals.length ? (
                  <div className="mt-3 flex min-w-0 items-center gap-2 overflow-hidden">
                    {supportingSignals.map((signal, index) => (
                      <div
                        key={`${signal.id}-sequence`}
                        className="flex shrink-0 items-center gap-2"
                      >
                        {index > 0 ? (
                          <span className="font-mono text-xs font-black text-zinc-700">
                            {"->"}
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full border px-3 py-1.5 font-mono text-xs font-black ${
                            isPositiveSignal(signal.result)
                              ? signal.side === "home"
                                ? "border-orange-300/35 bg-orange-950/40 text-orange-200"
                                : "border-sky-300/35 bg-sky-950/40 text-sky-200"
                              : "border-zinc-700 bg-black text-zinc-500"
                          }`}
                          title={`${sideName(run, signal.side)} ${signalEventLabel(signal)}`}
                        >
                          {signalEventLabel(signal)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 h-2 rounded-full bg-zinc-900" />
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3">
          <details className="axis-panel group rounded-lg px-4 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
                  More
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-700 transition group-open:text-zinc-500">
                  Players / time
                </span>
              </summary>

              <div className="mt-4 grid gap-3">
                {detailClusters.length ? (
                  detailClusters.map((cluster) => (
                    <div
                      key={`${cluster.id}-detail`}
                      className="rounded-lg border border-zinc-900 bg-black/70 px-3 py-3"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className={`truncate text-[10px] font-black uppercase tracking-[0.18em] ${labelTone(cluster.label)}`}>
                          {cluster.label}
                        </p>
                        <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-zinc-700">
                          {cluster.title}
                        </p>
                      </div>
                      <div className="grid gap-1.5">
                        {cluster.signals.slice(0, 5).map((signal) => {
                          const eventPlayer = playerLabel(run.players, signal.playerId)

                          return (
                            <div
                              key={`${signal.id}-cluster-detail`}
                              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-full bg-zinc-950 px-2 py-1.5"
                            >
                              <span
                                className={`grid h-7 w-7 place-items-center rounded-full border font-mono text-xs font-black ${
                                  isPositiveSignal(signal.result)
                                    ? signal.side === "home"
                                      ? "border-orange-300/50 bg-orange-300 text-black"
                                      : "border-sky-300/50 bg-sky-300 text-black"
                                    : signal.side === "home"
                                      ? "border-orange-300/35 bg-orange-950 text-orange-200"
                                      : "border-sky-300/35 bg-sky-950 text-sky-200"
                                }`}
                              >
                                {isPositiveSignal(signal.result) ? "+" : "-"}
                              </span>
                              <p className="min-w-0 truncate font-mono text-xs font-black text-zinc-200">
                                {signal.stat} {eventPlayer ? `/ ${eventPlayer}` : ""}
                              </p>
                              <span className="font-mono text-[10px] font-black text-zinc-600">
                                {seconds(signal.time)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-zinc-500">
                    The flow will open up here.
                  </p>
                )}
              </div>
            </details>
        </section>
      </div>
    </main>
  )
}
