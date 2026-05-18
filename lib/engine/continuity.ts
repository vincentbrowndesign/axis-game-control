import type { RunSignal, SignalSide } from "@/lib/run/signals"

export type ContinuityRun = {
  side: SignalSide | "none"
  result: RunSignal["result"] | "none"
  count: number
}

export type UnansweredRun = {
  side: SignalSide | "none"
  count: number
}

export function currentContinuity(signals: RunSignal[]): ContinuityRun {
  const latest = signals[signals.length - 1]
  if (!latest) {
    return {
      side: "none",
      result: "none",
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
    result: latest.result,
    count,
  }
}

export function unansweredMakes(signals: RunSignal[]): UnansweredRun {
  const latest = signals[signals.length - 1]
  if (!latest || latest.result !== "make") {
    return {
      side: "none",
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

export function continuityScore(run: ContinuityRun) {
  return Math.max(0, Math.min(1, run.count / 5))
}

export function momentumPersistence(signals: RunSignal[]) {
  const continuity = currentContinuity(signals)
  const unanswered = unansweredMakes(signals)

  return {
    continuity,
    unanswered,
    score: Math.max(continuityScore(continuity), Math.min(1, unanswered.count / 4)),
  }
}
