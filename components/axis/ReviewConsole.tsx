"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { buildActiveTemporalSession, type ActiveSequence } from "@/lib/engine/memoryGeneration"
import { createRun, formatRunTime, type Run, type RunPlayer } from "@/lib/run/runState"
import { readStoredRun, subscribeTemporalRun } from "@/lib/run/runStore"
import { isPositiveSignal, signalEventLabel, type RunSignal } from "@/lib/run/signals"

type ReviewMoment = {
  id: string
  title: string
  why: string
  sequence: string
  result: string
  start: number
  end: number
  signalIds: string[]
  source: "local" | "openai"
}

function playerLabel(players: RunPlayer[], playerId?: string) {
  const player = players.find((item) => item.id === playerId)

  if (!player) return ""

  return player.name ? ` #${player.number} ${player.name}` : ` #${player.number}`
}

function sideName(run: Run, signal?: RunSignal) {
  if (!signal) return "Game"

  return signal.side === "home" ? run.home : run.away
}

function scoreAt(run: Run, time: number) {
  return run.scoreEvents.reduce(
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

function resultLine(run: Run, start: number, end: number) {
  const before = scoreAt(run, start)
  const after = scoreAt(run, end)
  const homeChange = after.home - before.home
  const awayChange = after.away - before.away

  if (!homeChange && !awayChange) return `Score stayed ${after.home}-${after.away}.`

  if (homeChange > awayChange) {
    return `${run.home} stretched it from ${before.home}-${before.away} to ${after.home}-${after.away}.`
  }

  if (awayChange > homeChange) {
    return `${run.away} stretched it from ${before.home}-${before.away} to ${after.home}-${after.away}.`
  }

  return `Score moved from ${before.home}-${before.away} to ${after.home}-${after.away}.`
}

function sequenceLine(run: Run, signals: RunSignal[]) {
  return signals
    .slice(0, 6)
    .map((signal) => `${signal.stat}${playerLabel(run.players, signal.playerId)}`)
    .join(" -> ")
}

function localReviewMoment(run: Run, sequence: ActiveSequence): ReviewMoment {
  const signals = sequence.signals
  const positives = signals.filter((signal) => isPositiveSignal(signal.result)).length
  const negatives = signals.length - positives
  const turnovers = signals.filter((signal) => signal.stat === "TO").length
  const misses = signals.filter((signal) => signal.stat === "MISS").length
  const points = signals.filter((signal) => signal.stat === "PTS").length
  const owner = sideName(run, signals[0])
  const title =
    positives >= 3 && positives > negatives
      ? `${owner} Run`
      : turnovers >= 2
        ? "Rhythm Break"
        : negatives > positives
          ? "Cold Stretch"
          : "Swing Moment"
  const why =
    positives >= 3 && points
      ? "Everything started flowing here."
      : turnovers >= 2
        ? "Things got messy here."
        : misses >= 2
          ? "They lost rhythm."
          : negatives > positives
            ? "The game got stuck."
            : "This stretch changed the game."

  return {
    id: sequence.id,
    title,
    why,
    sequence: sequenceLine(run, signals),
    result: resultLine(run, sequence.start, sequence.end),
    start: sequence.start,
    end: sequence.end,
    signalIds: signals.map((signal) => signal.id),
    source: "local",
  }
}

function sequenceFromSignals(run: Run): ActiveSequence | null {
  const signals = run.signals.slice(-6)

  if (signals.length < 3) return null

  return {
    id: "review-live",
    label: "LIVE",
    title: "Live Stretch",
    summary: `${signals.length} recent events`,
    start: signals[0].time,
    end: signals[signals.length - 1].time,
    signals,
    media: run.media,
  }
}

function pulseTone(signal: RunSignal) {
  if (signal.side === "home") {
    return isPositiveSignal(signal.result)
      ? "border-orange-200 bg-orange-300 text-black shadow-[0_0_20px_rgba(253,186,116,0.28)]"
      : "border-orange-300/30 bg-orange-950 text-orange-200"
  }

  return isPositiveSignal(signal.result)
    ? "border-sky-200 bg-sky-300 text-black shadow-[0_0_20px_rgba(125,211,252,0.28)]"
    : "border-sky-300/30 bg-sky-950 text-sky-200"
}

export function ReviewConsole() {
  const [run, setRun] = useState<Run>(() => createRun())
  const [now, setNow] = useState(() => Date.now())
  const [remoteMoments, setRemoteMoments] = useState<ReviewMoment[] | null>(null)
  const requestKeyRef = useRef("")

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
  const reviewSequences = useMemo(() => {
    const sequences = session.sequences.filter((sequence) => sequence.signals.length >= 3).slice(0, 5)
    const live = sequenceFromSignals(run)

    return sequences.length ? sequences : live ? [live] : []
  }, [run, session.sequences])
  const localMoments = useMemo(
    () => reviewSequences.map((sequence) => localReviewMoment(run, sequence)),
    [reviewSequences, run]
  )
  const signalSignature = useMemo(
    () =>
      reviewSequences
        .flatMap((sequence) => sequence.signals)
        .map((signal) => `${signal.id}:${signal.stat}:${signal.playerId || ""}:${signal.time}`)
        .join("|"),
    [reviewSequences]
  )
  const scoreSignature = useMemo(
    () =>
      run.scoreEvents
        .map((event) => `${event.id}:${event.team}:${event.points}:${event.timestamp}`)
        .join("|"),
    [run.scoreEvents]
  )
  const requestKey = `${run.id}:${signalSignature}:${scoreSignature}:${run.audioContext?.generatedAt || 0}`
  const reviewMoments = remoteMoments || localMoments

  useEffect(() => {
    if (typeof window === "undefined") return
    if (localMoments.length < 1 || !signalSignature) return
    if (requestKeyRef.current === requestKey) return

    requestKeyRef.current = requestKey
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/infer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "review",
            run: {
              id: run.id,
              home: run.home,
              away: run.away,
              score: session.score,
              scoreEvents: run.scoreEvents,
              audioContext: run.audioContext,
            },
            moments: localMoments,
            sequences: reviewSequences.map((sequence) => ({
              id: sequence.id,
              label: sequence.label,
              title: sequence.title,
              summary: sequence.summary,
              start: sequence.start,
              end: sequence.end,
              signals: sequence.signals.map((signal, index) => ({
                id: signal.id,
                side: signal.side,
                result: signal.result,
                polarity: signal.polarity,
                stat: signal.stat,
                playerId: signal.playerId,
                player: playerLabel(run.players, signal.playerId),
                time: signal.time,
                order: index + 1,
              })),
            })),
          }),
          signal: controller.signal,
        })

        if (!response.ok) return

        const data = (await response.json()) as {
          review?: {
            moments?: ReviewMoment[]
          }
        }

        if (!Array.isArray(data.review?.moments) || !data.review.moments.length) return

        setRemoteMoments(data.review.moments)
      } catch (error) {
        if (!controller.signal.aborted) console.error(error)
      }
    }, 900)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [
    localMoments,
    requestKey,
    reviewSequences,
    run.audioContext,
    run.away,
    run.home,
    run.id,
    run.players,
    run.scoreEvents,
    session.score,
    signalSignature,
  ])

  if (!reviewMoments.length) {
    return (
      <main className="axis-shell grid min-h-screen place-items-center px-4 text-zinc-100">
        <div className="max-w-sm text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
            Review
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.05em]">
            Nothing to review yet
          </h1>
          <p className="mt-3 text-sm font-bold leading-6 text-zinc-600">
            Tap a few events. The stretch will show up here.
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
      <div className="mx-auto grid max-w-6xl gap-4">
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
              {session.score.home}-{session.score.away}
            </div>
            <p className="truncate text-right text-xl font-black uppercase leading-none text-sky-200 sm:text-3xl">
              {run.away}
            </p>
          </div>
        </header>

        <section className="rounded-[1.5rem] border border-zinc-900 bg-black/75 p-5 sm:p-7">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
            Review
          </p>
          <h1 className="mt-3 max-w-3xl text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] text-zinc-100 sm:text-7xl">
            What changed.
          </h1>
        </section>

        <section className="grid gap-4">
          {reviewMoments.map((moment, index) => {
            const signals = run.signals.filter((signal) => moment.signalIds.includes(signal.id))
            const storyBlock = (run.storyBlocks ?? []).find(
              (block) =>
                block.signalIds.some((signalId) => moment.signalIds.includes(signalId)) ||
                (block.start <= moment.end && block.end >= moment.start)
            )

            return (
              <article key={moment.id} className="overflow-hidden rounded-[1.5rem] border border-zinc-900 bg-black/80">
                {storyBlock ? (
                  <div className="relative min-h-56 bg-black sm:min-h-72">
                    {storyBlock.media.contentType.startsWith("video/") ? (
                      <video
                        src={storyBlock.media.url}
                        className="absolute inset-0 h-full w-full object-cover opacity-80"
                        muted
                        playsInline
                        loop
                        autoPlay
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-cover bg-center opacity-80"
                        style={{
                          backgroundImage: `url(${storyBlock.media.url})`,
                        }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                    <div className="absolute bottom-4 left-5 rounded-full border border-white/12 bg-black/45 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-100 backdrop-blur">
                      {storyBlock.sticker}
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-5 p-5 sm:grid-cols-[0.95fr_1.05fr] sm:p-6">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">
                        Moment {index + 1}
                      </p>
                      <p className="font-mono text-[10px] font-black text-zinc-700">
                        {formatRunTime(moment.start)} - {formatRunTime(moment.end)}
                      </p>
                    </div>
                    <h2 className="mt-4 text-4xl font-black uppercase leading-[0.9] tracking-[-0.05em] text-zinc-100 sm:text-5xl">
                      {moment.title}
                    </h2>
                    <div className="mt-6 grid gap-5">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-700">
                          Why it mattered
                        </p>
                        <p className="mt-2 text-xl font-black leading-7 text-zinc-400">
                          {moment.why}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-700">
                          Result
                        </p>
                        <p className="mt-2 text-base font-black leading-6 text-zinc-200">
                          {moment.result}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid min-w-0 gap-4">
                    <div className="rounded-[1.25rem] border border-zinc-900 bg-black p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-700">
                        Sequence
                      </p>
                      <p className="mt-3 font-mono text-lg font-black uppercase leading-8 text-zinc-100">
                        {moment.sequence}
                      </p>
                    </div>

                    <div className="relative min-h-24 overflow-hidden rounded-[1.25rem] border border-zinc-900 bg-[#070707] px-4">
                      <div className="absolute inset-x-4 top-1/2 h-px bg-zinc-800" />
                      <div className="relative flex min-h-24 items-center gap-3 overflow-x-auto">
                        {signals.map((signal) => (
                          <span
                            key={`${moment.id}-${signal.id}`}
                            className="grid shrink-0 justify-items-center gap-2"
                            title={signalEventLabel(signal)}
                          >
                            <span
                              className={`grid rounded-full border font-mono text-xs font-black ${
                                isPositiveSignal(signal.result) ? "h-8 w-8" : "h-5 w-5"
                              } ${pulseTone(signal)}`}
                            >
                              <span className="m-auto">
                                {isPositiveSignal(signal.result) ? "+" : "-"}
                              </span>
                            </span>
                            <span className="font-mono text-[10px] font-black text-zinc-600">
                              {signal.stat}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <details className="border-t border-zinc-900 px-5 py-4 sm:px-6">
                  <summary className="cursor-pointer list-none text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                    Watch
                  </summary>
                  <div className="mt-4 grid gap-2">
                    <p className="text-sm font-bold leading-6 text-zinc-500">
                      Watch the spacing between events, the first break in rhythm, and who answered after the stretch changed.
                    </p>
                    {run.audioContext ? (
                      <p className="text-sm font-bold leading-6 text-zinc-600">
                        The quiet, the lift, and the pace helped shape this moment.
                      </p>
                    ) : null}
                  </div>
                </details>
              </article>
            )
          })}
        </section>
      </div>
    </main>
  )
}
