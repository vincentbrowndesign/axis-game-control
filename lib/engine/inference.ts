import { deriveAxisState } from "@/lib/engine/state"
import type { Run } from "@/lib/run/runState"
import type { RunSignal, SignalSide } from "@/lib/run/signals"

export type TrackInference = {
  control: string
  momentum: string
  instability: string
  recovery: string
  pressure: string
  streak: string
  shift: string
  strongestMoment: string
}

function seconds(value: number) {
  return `${Math.max(0, Math.round(value / 1000))}s`
}

function sideName(run: Run, side: SignalSide) {
  return side === "home" ? run.home : run.away
}

function latestRun(signals: RunSignal[]) {
  const latest = signals[signals.length - 1]
  if (!latest) return []

  const run = []

  for (let index = signals.length - 1; index >= 0; index -= 1) {
    const signal = signals[index]
    if (signal.side !== latest.side || signal.result !== latest.result) break
    run.unshift(signal)
  }

  return run
}

function sideRecovery(run: Run, side: SignalSide) {
  const misses = run.signals.filter(
    (signal, index) =>
      signal.side === side &&
      signal.result === "miss" &&
      run.signals[index + 1]?.side === side &&
      run.signals[index + 1]?.result === "make"
  )

  return misses.length
}

function shiftCount(signals: RunSignal[]) {
  let shifts = 0

  for (let index = 1; index < signals.length; index += 1) {
    if (signals[index].side !== signals[index - 1].side) shifts += 1
  }

  return shifts
}

export function inferTrack(run: Run): TrackInference {
  const axisState = deriveAxisState(run)
  const latest = run.signals[run.signals.length - 1]
  const latestCluster = latestRun(run.signals)
  const recent = run.signals.slice(-6)
  const recentMisses = recent.filter((signal) => signal.result === "miss").length
  const shifts = shiftCount(recent)
  const homeRecovery = sideRecovery(run, "home")
  const awayRecovery = sideRecovery(run, "away")
  const strongest = run.moments[0]

  return {
    control:
      axisState.leader === "even"
        ? "Control even"
        : `${sideName(run, axisState.leader)} control`,
    momentum: latest
      ? `${sideName(run, latest.side)} ${latest.result} at ${seconds(latest.time)}`
      : "Awaiting first signal",
    instability:
      recentMisses >= 3
        ? "Instability rising"
        : shifts >= 3
          ? "Control shifting"
          : "Flow stable",
    recovery:
      homeRecovery === awayRecovery
        ? "Recovery even"
        : homeRecovery > awayRecovery
          ? `${run.home} recovering faster`
          : `${run.away} recovering faster`,
    pressure:
      axisState.label === "BREAKING"
        ? "Pressure breaking"
        : axisState.label === "UNSTABLE"
          ? "Pressure unstable"
          : "Pressure contained",
    streak: latestCluster.length
      ? `${latestCluster.length} ${latestCluster[0].result} signal streak`
      : "No streak yet",
    shift: shifts ? `${shifts} recent control shifts` : "No shift yet",
    strongestMoment: strongest?.label || "No moment stored yet",
  }
}
