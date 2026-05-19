"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { formatRunTime, type Run, type RunStoryBlock } from "@/lib/run/runState"
import { readStoredRun, readStoredRuns, subscribeTemporalRun } from "@/lib/run/runStore"

type ThreadMoment = {
  run: Run
  block: RunStoryBlock
}

function uniqueRuns(runs: Run[]) {
  const seen = new Set<string>()

  return runs.filter((run) => {
    if (seen.has(run.id)) return false

    seen.add(run.id)

    return true
  })
}

function momentHref(moment: ThreadMoment) {
  return `/sequence/${moment.block.id}`
}

function scoreLabel(block: RunStoryBlock) {
  return `${block.score.home}-${block.score.away}`
}

function timeLabel(block: RunStoryBlock) {
  return formatRunTime(block.start)
}

function MomentMedia({ block, priority = false }: { block: RunStoryBlock; priority?: boolean }) {
  if (block.media.contentType.startsWith("video/")) {
    return (
      <video
        src={block.media.url}
        className="absolute inset-0 h-full w-full object-cover opacity-82"
        muted
        playsInline
        loop={priority}
        autoPlay={priority}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 bg-cover bg-center opacity-82"
      style={{
        backgroundImage: `url(${block.media.url})`,
      }}
    />
  )
}

export function MemoryThreadHome() {
  const [activeRun, setActiveRun] = useState<Run | null>(null)
  const [storedRuns, setStoredRuns] = useState<Run[]>([])

  useEffect(() => {
    if (typeof window === "undefined") return

    const read = () => {
      setActiveRun(readStoredRun())
      setStoredRuns(readStoredRuns())
    }
    const unsubscribe = subscribeTemporalRun((run) => {
      setActiveRun(run)
      setStoredRuns(readStoredRuns())
    })

    read()

    return () => unsubscribe()
  }, [])

  const runs = useMemo(
    () => uniqueRuns([...(activeRun ? [activeRun] : []), ...storedRuns]),
    [activeRun, storedRuns]
  )
  const threadMoments = useMemo(
    () =>
      runs
        .flatMap((run) =>
          (run.storyBlocks ?? []).map((block) => ({
            run,
            block,
          }))
        )
        .sort((a, b) => b.block.capturedAt - a.block.capturedAt),
    [runs]
  )
  const liveRun = activeRun ?? runs[0]
  const heroMoment = threadMoments[0]
  const recentMoments = threadMoments.slice(0, 6)
  const liveThreads = runs
    .filter((run) => run.signals.length || run.storyBlocks?.length)
    .slice(0, 4)

  return (
    <main className="axis-shell min-h-screen px-4 pb-10 pt-5 text-zinc-100 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
              Axis
            </p>
            <h1 className="mt-1 text-3xl font-black uppercase tracking-[-0.06em] text-zinc-100 sm:text-5xl">
              Memory thread.
            </h1>
          </div>
          <Link
            href="/tap"
            className="rounded-full border border-emerald-400/25 bg-emerald-950/20 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200 transition active:scale-[0.98] hover:border-emerald-300"
          >
            Live
          </Link>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <Link
            href={heroMoment ? momentHref(heroMoment) : "/tap"}
            className="group relative min-h-[32rem] overflow-hidden rounded-[1.75rem] border border-zinc-900 bg-black shadow-[0_24px_90px_rgba(0,0,0,0.45)]"
          >
            {heroMoment ? (
              <MomentMedia block={heroMoment.block} priority />
            ) : (
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(244,244,245,0.1),transparent_34%),linear-gradient(180deg,rgba(24,24,27,0.22),rgba(0,0,0,0.94))]" />
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-black via-black/16 to-black/20" />
            <span className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3 rounded-full border border-white/10 bg-black/40 px-4 py-2 backdrop-blur">
              <span className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                {liveRun ? `${liveRun.home} / ${liveRun.away}` : "No game yet"}
              </span>
              <span className="font-mono text-[10px] font-black text-emerald-300">
                {heroMoment ? timeLabel(heroMoment.block) : "00:00"}
              </span>
            </span>
            <span className="absolute bottom-5 left-5 right-5 grid gap-3">
              <span className="w-fit rounded-full border border-white/12 bg-black/45 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-200 backdrop-blur">
                {heroMoment?.block.sticker ?? "Start live"}
              </span>
              <span className="block text-5xl font-black uppercase leading-none tracking-[-0.07em] text-zinc-100 sm:text-7xl">
                {heroMoment ? "Caught." : "Catch the game."}
              </span>
              <span className="flex items-center gap-3">
                <span className="font-mono text-2xl font-black text-zinc-200">
                  {heroMoment ? scoreLabel(heroMoment.block) : "0-0"}
                </span>
                <span className="h-1 w-1 rounded-full bg-zinc-700" />
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                  Continuity memory
                </span>
              </span>
            </span>
          </Link>

          <section className="grid content-start gap-3">
            <div className="axis-panel rounded-[1.5rem] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
                  Recent moments
                </p>
                <Link
                  href="/track"
                  className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600 transition hover:text-zinc-300"
                >
                  Track
                </Link>
              </div>
              <div className="mt-4 grid gap-2">
                {recentMoments.length ? (
                  recentMoments.map((moment) => (
                    <Link
                      key={`${moment.run.id}-${moment.block.id}`}
                      href={momentHref(moment)}
                      className="grid grid-cols-[4.75rem_1fr_auto] items-center gap-3 rounded-2xl border border-zinc-900 bg-black/55 p-2 transition hover:border-zinc-700"
                    >
                      <span className="relative h-16 overflow-hidden rounded-xl bg-zinc-950">
                        <MomentMedia block={moment.block} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black uppercase tracking-[-0.02em] text-zinc-100">
                          {moment.block.sticker}
                        </span>
                        <span className="mt-1 block truncate text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
                          {moment.run.home} / {moment.run.away}
                        </span>
                      </span>
                      <span className="grid justify-items-end gap-1">
                        <span className="font-mono text-xs font-black text-zinc-300">
                          {scoreLabel(moment.block)}
                        </span>
                        <span className="font-mono text-[10px] font-black text-zinc-600">
                          {timeLabel(moment.block)}
                        </span>
                      </span>
                    </Link>
                  ))
                ) : (
                  <Link
                    href="/tap"
                    className="rounded-2xl border border-dashed border-zinc-800 bg-black/45 p-4 text-sm font-black uppercase tracking-[0.16em] text-zinc-500"
                  >
                    Catch the first moment.
                  </Link>
                )}
              </div>
            </div>
          </section>
        </section>

        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
              Continuity threads
            </p>
            <p className="font-mono text-[10px] font-black text-zinc-700">
              {liveThreads.length}
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {liveThreads.length ? (
              liveThreads.map((run) => {
                const blocks = run.storyBlocks ?? []
                const latest = blocks[blocks.length - 1]

                return (
                  <Link
                    key={`${run.id}-thread`}
                    href={latest ? `/sequence/${latest.id}` : "/track"}
                    className="min-w-72 rounded-[1.5rem] border border-zinc-900 bg-black/70 p-3 transition hover:border-zinc-700"
                  >
                    <div className="flex h-24 items-center gap-1 overflow-hidden rounded-2xl bg-zinc-950 px-2">
                      {blocks.slice(-8).map((block) => (
                        <span
                          key={`${block.id}-pulse`}
                          className="relative h-16 w-10 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900"
                        >
                          <MomentMedia block={block} />
                        </span>
                      ))}
                      {!blocks.length ? (
                        <span className="h-1 w-full rounded-full bg-zinc-900" />
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black uppercase leading-none text-zinc-100">
                          {run.home} / {run.away}
                        </p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
                          {blocks.length} moments / {run.signals.length} signals
                        </p>
                      </div>
                      <p className="font-mono text-sm font-black text-zinc-400">
                        {latest ? scoreLabel(latest) : "0-0"}
                      </p>
                    </div>
                  </Link>
                )
              })
            ) : (
              <Link
                href="/tap"
                className="min-w-full rounded-[1.5rem] border border-zinc-900 bg-black/70 p-5 text-sm font-black uppercase tracking-[0.16em] text-zinc-500"
              >
                Live memory starts in Tap.
              </Link>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
