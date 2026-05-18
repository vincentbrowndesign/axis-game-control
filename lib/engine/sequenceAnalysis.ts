import { elapsedRunMs, type Run } from "@/lib/run/runState"
import type { RunSignal, SignalSide } from "@/lib/run/signals"

export type SequenceWindow = {
  recent: RunSignal[]
  lastFiveSeconds: RunSignal[]
  lastTwentySeconds: RunSignal[]
  older: RunSignal[]
}

export type SequenceAnalysis = {
  attempts: number
  makes: number
  misses: number
  frequency: number
  recency: number
  continuity: number
  interruption: number
  responseDelay: number
  signalDensity: number
  unanswered: {
    side: SignalSide | "none"
    count: number
  }
  clusteredMisses: number
  longestDroughtMs: number
  currentDroughtMs: number
  alternatingInstability: number
  acceleration: number
  continuitySide: SignalSide | "none"
  windows: SequenceWindow
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function signalWeight(ageMs: number) {
  if (ageMs <= 5_000) return 1
  if (ageMs <= 20_000) return 0.58
  if (ageMs <= 60_000) return 0.24

  return 0.08
}

function intervalAverage(signals: RunSignal[]) {
  if (signals.length < 2) return 0

  let total = 0

  for (let index = 1; index < signals.length; index += 1) {
    total += Math.max(0, signals[index].time - signals[index - 1].time)
  }

  return total / (signals.length - 1)
}

function currentContinuity(signals: RunSignal[]) {
  const latest = signals[signals.length - 1]
  if (!latest) {
    return {
      side: "none" as const,
      count: 0,
    }
  }

  let count = 0

  for (let index = signals.length - 1; index >= 0; index -= 1) {
    const signal = signals[index]
    if (signal.side !== latest.side || signal.result !== latest.result) break
    count += 1
  }

  return {
    side: latest.side,
    count,
  }
}

function unansweredMakes(signals: RunSignal[]) {
  const latest = signals[signals.length - 1]
  if (!latest || latest.result !== "make") {
    return {
      side: "none" as const,
      count: 0,
    }
  }

  let count = 0

  for (let index = signals.length - 1; index >= 0; index -= 1) {
    const signal = signals[index]
    if (signal.side !== latest.side || signal.result !== "make") break
    count += 1
  }

  return {
    side: latest.side,
    count,
  }
}

function clusteredMisses(signals: RunSignal[]) {
  let count = 0

  for (let index = signals.length - 1; index >= 0; index -= 1) {
    if (signals[index].result !== "miss") break
    count += 1
  }

  return count
}

function alternatingInstability(signals: RunSignal[]) {
  const recent = signals.slice(-6)
  let alternations = 0

  for (let index = 1; index < recent.length; index += 1) {
    if (recent[index].side !== recent[index - 1].side) alternations += 1
  }

  return alternations
}

function droughts(signals: RunSignal[], currentTime: number) {
  const makes = signals.filter((signal) => signal.result === "make")

  if (!signals.length || !makes.length) {
    return {
      longestDroughtMs: signals.length ? currentTime : 0,
      currentDroughtMs: signals.length ? currentTime : 0,
    }
  }

  let longestDroughtMs = makes[0].time

  for (let index = 1; index < makes.length; index += 1) {
    longestDroughtMs = Math.max(longestDroughtMs, makes[index].time - makes[index - 1].time)
  }

  const latestMake = makes[makes.length - 1]
  const currentDroughtMs = Math.max(0, currentTime - latestMake.time)

  return {
    longestDroughtMs: Math.max(longestDroughtMs, currentDroughtMs),
    currentDroughtMs,
  }
}

function responseDelay(signals: RunSignal[]) {
  const delays: number[] = []

  for (let index = 1; index < signals.length; index += 1) {
    if (signals[index - 1].result === "miss" && signals[index].result === "make") {
      delays.push(Math.max(0, signals[index].time - signals[index - 1].time))
    }
  }

  if (!delays.length) return 0

  return delays.reduce((total, value) => total + value, 0) / delays.length
}

function acceleration(signals: RunSignal[]) {
  if (signals.length < 5) return 0

  const firstHalf = signals.slice(0, Math.floor(signals.length / 2))
  const secondHalf = signals.slice(Math.floor(signals.length / 2))
  const early = intervalAverage(firstHalf)
  const late = intervalAverage(secondHalf)

  if (!early || !late) return 0

  return clamp((early - late) / early, -1, 1)
}

export function analyzeSequence(run: Run, now = Date.now()): SequenceAnalysis {
  const currentTime = elapsedRunMs(run, now)
  const signals = [...run.signals].sort((a, b) => a.time - b.time)
  const attempts = signals.length
  const makes = signals.filter((signal) => signal.result === "make").length
  const misses = attempts - makes
  const windows: SequenceWindow = {
    recent: signals.filter((signal) => currentTime - signal.time <= 60_000),
    lastFiveSeconds: signals.filter((signal) => currentTime - signal.time <= 5_000),
    lastTwentySeconds: signals.filter((signal) => currentTime - signal.time <= 20_000),
    older: signals.filter((signal) => currentTime - signal.time > 60_000),
  }
  const weightedSignals = signals.reduce(
    (total, signal) => total + signalWeight(Math.max(0, currentTime - signal.time)),
    0
  )
  const continuity = currentContinuity(signals)
  const interruptions = signals.filter(
    (signal, index) =>
      index > 0 &&
      (signal.side !== signals[index - 1].side || signal.result !== signals[index - 1].result)
  ).length
  const averageInterval = intervalAverage(signals)
  const drought = droughts(signals, currentTime)
  const recoveryDelay = responseDelay(signals)

  return {
    attempts,
    makes,
    misses,
    frequency: attempts ? attempts / Math.max(1, currentTime / 60_000) : 0,
    recency: clamp(weightedSignals / Math.max(1, attempts)),
    continuity: clamp(continuity.count / 5),
    interruption: attempts > 1 ? clamp(interruptions / (attempts - 1)) : 0,
    responseDelay: recoveryDelay,
    signalDensity: averageInterval ? clamp(1 - averageInterval / 20_000) : 0,
    unanswered: unansweredMakes(signals),
    clusteredMisses: clusteredMisses(signals),
    longestDroughtMs: drought.longestDroughtMs,
    currentDroughtMs: drought.currentDroughtMs,
    alternatingInstability: alternatingInstability(signals),
    acceleration: acceleration(signals),
    continuitySide: continuity.side,
    windows,
  }
}
