"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { buildActiveTemporalSession } from "@/lib/engine/memoryGeneration"
import { createRun, formatRunTime, type Run, type RunPlayer } from "@/lib/run/runState"
import { readStoredRun, subscribeTemporalRun } from "@/lib/run/runStore"
import { isPositiveSignal, signalEventLabel, type RunSignal } from "@/lib/run/signals"

type ReportObservation = {
  title: string
  why: string
  result: string
  source: "local" | "openai"
}

function playerLabel(players: RunPlayer[], playerId?: string) {
  const player = players.find((item) => item.id === playerId)

  if (!player) return ""

  return player.name ? ` #${player.number} ${player.name}` : ` #${player.number}`
}

function scoreAt(run: Run, time: number) {
  return (run.scoreEvents ?? []).reduce(
    (score, event) => {
      if (event.timestamp <= time) {
        if (event.team === "home") score.home += event.points
        else score.away += event.points
      }

      return score
    },
    {
      home: 0,
      away: 0,
    }
  )
}

function scoreLine(run: Run, start: number, end: number) {
  const before = scoreAt(run, start)
  const after = scoreAt(run, end)

  if (before.home === after.home && before.away === after.away) {
    return `Score stayed ${after.home}-${after.away}.`
  }

  return `Score moved from ${before.home}-${before.away} to ${after.home}-${after.away}.`
}

function sideName(run: Run, signal?: RunSignal) {
  if (!signal) return "Game"

  return signal.side === "home" ? run.home : run.away
}

function localObservation(run: Run, signals: RunSignal[], start: number, end: number): ReportObservation {
  const positives = signals.filter((signal) => isPositiveSignal(signal.result)).length
  const negatives = signals.length - positives
  const first = signals[0]
  const owner = sideName(run, first)
  const points = signals.filter((signal) => signal.stat === "PTS").length
  const turnovers = signals.filter((signal) => signal.stat === "TO").length
  const misses = signals.filter((signal) => signal.stat === "MISS").length
  const title =
    positives >= 3 && positives > negatives
      ? `${owner} Run`
      : turnovers + misses >= 2
        ? "Rhythm Break"
        : negatives > positives
          ? "Cold Stretch"
          : "Turning Point"
  const why =
    positives >= 3 && points >= 1
      ? "Everything started flowing here."
      : turnovers >= 2
        ? "They lost rhythm here."
        : misses >= 2
          ? "The game slowed down in this stretch."
          : negatives > positives
            ? "The possession rhythm broke."
            : "This stretch changed the feel of the game."

  return {
    title,
    why,
    result: scoreLine(run, start, end),
    source: "local",
  }
}

function sequenceText(run: Run, signals: RunSignal[]) {
  return signals
    .slice(0, 8)
    .map((signal) => `${signal.stat}${playerLabel(run.players, signal.playerId)}`)
    .join(" \u2192 ")
}

function pulseTone(signal: RunSignal) {
  if (signal.side === "home") {
    return isPositiveSignal(signal.result)
      ? "border-orange-200 bg-orange-300 text-black shadow-[0_0_22px_rgba(253,186,116,0.36)]"
      : "border-orange-300/35 bg-orange-950 text-orange-200"
  }

  return isPositiveSignal(signal.result)
    ? "border-sky-200 bg-sky-300 text-black shadow-[0_0_22px_rgba(125,211,252,0.36)]"
    : "border-sky-300/35 bg-sky-950 text-sky-200"
}

export function ReportConsole({ reportId }: { reportId: string }) {
  const [run, setRun] = useState<Run>(() => createRun())
  const [now, setNow] = useState(() => Date.now())
  const [remoteObservation, setRemoteObservation] = useState<
    (ReportObservation & { key: string }) | null
  >(null)
  const lastReportKeyRef = useRef("")

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
  const selectedSequence = useMemo(
    () =>
      session.sequences.find((sequence) => sequence.id === reportId) ||
      session.sequences[0],
    [reportId, session.sequences]
  )
  const signals = useMemo(
    () => (selectedSequence?.signals.length ? selectedSequence.signals : run.signals.slice(-8)),
    [run.signals, selectedSequence]
  )
  const signalSignature = useMemo(
    () =>
      signals
        .map((signal) => `${signal.id}:${signal.stat}:${signal.playerId || ""}:${signal.time}`)
        .join("|"),
    [signals]
  )
  const start = selectedSequence?.start ?? signals[0]?.time ?? 0
  const end = selectedSequence?.end ?? signals[signals.length - 1]?.time ?? 0
  const local = useMemo(
    () => localObservation(run, signals, start, end),
    [end, run, signals, start]
  )
  const score = session.score
  const sequence = sequenceText(run, signals)
  const playerSignature = useMemo(
    () =>
      run.players
        .map((player) => `${player.id}:${player.number}:${player.name || ""}`)
        .join("|"),
    [run.players]
  )
  const scoreEventSignature = useMemo(
    () =>
      run.scoreEvents
        .map((event) => `${event.id}:${event.team}:${event.points}:${event.timestamp}`)
        .join("|"),
    [run.scoreEvents]
  )
  const reportKey = useMemo(
    () =>
      [
        reportId,
        start,
        end,
        score.home,
        score.away,
        signalSignature,
        playerSignature,
        scoreEventSignature,
      ].join("::"),
    [
      end,
      playerSignature,
      reportId,
      score.away,
      score.home,
      scoreEventSignature,
      signalSignature,
      start,
    ]
  )
  const observation = remoteObservation?.key === reportKey ? remoteObservation : local

  useEffect(() => {
    if (typeof window === "undefined") return
    if (signals.length < 2) return

    if (lastReportKeyRef.current === reportKey) return

    lastReportKeyRef.current = reportKey

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/infer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "report",
            run: {
              id: run.id,
              home: run.home,
              away: run.away,
              startedAt: run.startedAt,
              pausedMs: run.pausedMs ?? 0,
              score,
              scoreEvents: run.scoreEvents,
              audioContext: run.audioContext,
            },
            report: {
              id: reportId,
              start,
              end,
            },
            signals: signals.map((signal, index) => ({
              id: signal.id,
              side: signal.side,
              result: signal.result,
              polarity: signal.polarity,
              stat: signal.stat,
              playerId: signal.playerId,
              player: playerLabel(run.players, signal.playerId),
              time: signal.time,
              order: index + 1,
              interval: index > 0 ? signal.time - signals[index - 1].time : 0,
            })),
            fallback: local,
          }),
          signal: controller.signal,
        })

        if (!response.ok) return

        const data = (await response.json()) as {
          report?: Partial<ReportObservation>
        }

        if (!data.report?.title || !data.report.why || !data.report.result) return

        setRemoteObservation({
          key: reportKey,
          title: data.report.title,
          why: data.report.why,
          result: data.report.result,
          source: data.report.source === "openai" ? "openai" : "local",
        })
      } catch (error) {
        if (!controller.signal.aborted) console.error(error)
      }
    }, 700)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [
    end,
    local,
    playerSignature,
    reportId,
    reportKey,
    run.audioContext,
    run.away,
    run.home,
    run.id,
    run.pausedMs,
    run.players,
    run.scoreEvents,
    run.startedAt,
    score,
    score.away,
    score.home,
    scoreEventSignature,
    signalSignature,
    signals,
    start,
  ])

  if (!signals.length) {
    return (
      <main className="axis-shell grid min-h-screen place-items-center px-4 text-zinc-100">
        <div className="max-w-sm text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
            Report
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.05em]">
            No report yet
          </h1>
          <p className="mt-3 text-sm font-bold leading-6 text-zinc-600">
            Tap a few events, then come back to review what changed.
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
    <main className="axis-shell min-h-screen px-4 pb-10 pt-4 text-zinc-100 sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-4">
        <header className="grid gap-3 border-b border-zinc-900/90 pb-3">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/track"
              className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 transition hover:text-zinc-300"
            >
              Track
            </Link>
            <p className="font-mono text-xs font-black text-emerald-300">
              {formatRunTime(session.runtime)}
            </p>
            <Link
              href="/tap"
              className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 transition hover:text-zinc-300"
            >
              Tap
            </Link>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <p className="truncate text-xl font-black uppercase leading-none text-orange-200 sm:text-3xl">
              {run.home}
            </p>
            <div className="rounded-full border border-zinc-800 bg-black px-4 py-2 font-mono text-xl font-black text-zinc-100">
              {score.home}-{score.away}
            </div>
            <p className="truncate text-right text-xl font-black uppercase leading-none text-sky-200 sm:text-3xl">
              {run.away}
            </p>
          </div>
        </header>

        <article className="axis-panel overflow-hidden rounded-lg p-5 sm:p-7">
          <div className="grid gap-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
                Review
              </p>
              <h1 className="mt-3 text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] text-zinc-100 sm:text-7xl">
                {observation.title}
              </h1>
              <p className="mt-5 max-w-2xl text-xl font-black leading-7 text-zinc-400 sm:text-2xl">
                {observation.why}
              </p>
            </div>

            <div className="grid gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
                Sequence
              </p>
              <div className="rounded-lg border border-zinc-900 bg-black p-4">
                <p className="font-mono text-lg font-black uppercase leading-8 text-zinc-100 sm:text-2xl">
                  {sequence}
                </p>
              </div>
            </div>

            <div className="axis-glass rounded-lg px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
                Result
              </p>
              <p className="mt-2 text-2xl font-black leading-7 tracking-[-0.04em] text-zinc-100 sm:text-4xl">
                {observation.result}
              </p>
            </div>
          </div>
        </article>

        <section className="axis-panel rounded-lg p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
              Game Memory
            </p>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-700">
              {observation.source === "openai" ? "OpenAI" : "Temporal"}
            </p>
          </div>

          <div className="mt-4 flex min-h-20 items-center gap-3 overflow-x-auto rounded-md border border-zinc-900 bg-[#070707] px-4">
            {signals.map((signal) => (
              <div
                key={`${signal.id}-report`}
                className="grid shrink-0 justify-items-center gap-2"
                title={`${signalEventLabel(signal)}${playerLabel(run.players, signal.playerId)}`}
              >
                <span
                  className={`grid rounded-full border font-mono text-xs font-black ${
                    isPositiveSignal(signal.result) ? "h-7 w-7" : "h-5 w-5"
                  } ${pulseTone(signal)}`}
                >
                  <span className="m-auto">{isPositiveSignal(signal.result) ? "+" : "-"}</span>
                </span>
                <span className="font-mono text-[10px] font-black text-zinc-500">
                  {signal.stat}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
