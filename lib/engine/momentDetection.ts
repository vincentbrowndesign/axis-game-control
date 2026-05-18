import type { Run } from "@/lib/run/runState"
import type { RunSignal } from "@/lib/run/signals"
import type { BehavioralLabel } from "./behavioralState"
import type { SequenceAnalysis } from "./sequenceAnalysis"

export type TemporalMoment = {
  id: string
  label: BehavioralLabel
  name: string
  summary: string
  start: number
  end: number
  signalIds: string[]
}

function labelCluster(signals: RunSignal[]): BehavioralLabel {
  const makes = signals.filter((signal) => signal.result === "make").length
  const misses = signals.length - makes
  const alternations = signals.filter(
    (signal, index) => index > 0 && signal.side !== signals[index - 1].side
  ).length

  if (misses >= 3) return "COLD"
  if (alternations >= 2) return "SWING"
  if (makes >= 3) return "SPURT"

  return "HOT"
}

function nameFor(label: BehavioralLabel, signals: RunSignal[], run: Run) {
  const first = signals[0]
  const owner = first?.side === "away" ? run.away : run.home

  if (label === "COLD") return "Cold Stretch"
  if (label === "SWING") return "Momentum Swing"
  if (label === "SPURT") return `${owner} Spurt`
  if (label === "HOT") return `${owner} Hot`

  return "Replay Window"
}

function summaryFor(label: BehavioralLabel, signals: RunSignal[]) {
  const span = Math.max(0, signals[signals.length - 1].time - signals[0].time)
  const seconds = Math.max(1, Math.round(span / 1000))

  if (label === "COLD") return `${signals.length} stalled signals / ${seconds}s`
  if (label === "SWING") return `${signals.length} changing signals / ${seconds}s`
  if (label === "SPURT") return `${signals.length} signals clustered / ${seconds}s`

  return `${signals.length} recent signals / ${seconds}s`
}

export function detectTemporalMoments(run: Run, analysis: SequenceAnalysis): TemporalMoment[] {
  const signals = [...run.signals].sort((a, b) => a.time - b.time)
  const moments: TemporalMoment[] = []

  for (let start = 0; start < signals.length; start += 1) {
    const cluster = [signals[start]]

    for (let end = start + 1; end < signals.length; end += 1) {
      const next = signals[end]
      const previous = cluster[cluster.length - 1]
      const compact = next.time - previous.time <= 9_000
      const related = next.side === previous.side || next.result === previous.result

      if (next.time - cluster[0].time > 45_000) break
      if (compact || related) cluster.push(next)
    }

    if (cluster.length < 3) continue

    const label = labelCluster(cluster)
    const first = cluster[0]
    const last = cluster[cluster.length - 1]

    moments.push({
      id: `temporal-${first.id}-${last.id}`,
      label,
      name: nameFor(label, cluster, run),
      summary: summaryFor(label, cluster),
      start: first.time,
      end: last.time,
      signalIds: cluster.map((signal) => signal.id),
    })
  }

  if (!moments.length && analysis.unanswered.count >= 2) {
    const cluster = signals.slice(-analysis.unanswered.count)
    const first = cluster[0]
    const last = cluster[cluster.length - 1]

    moments.push({
      id: `temporal-live-${first.id}-${last.id}`,
      label: "HOT",
      name: `${analysis.unanswered.side.toUpperCase()} Hot`,
      summary: `${cluster.length} unanswered makes`,
      start: first.time,
      end: last.time,
      signalIds: cluster.map((signal) => signal.id),
    })
  }

  return moments
    .filter(
      (moment, index, list) =>
        list.findIndex((item) => item.id === moment.id) === index
    )
    .sort((a, b) => b.end - a.end)
    .slice(0, 6)
}
