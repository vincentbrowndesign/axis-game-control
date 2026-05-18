import type { Run } from "@/lib/run/runState"
import { isPositiveSignal, type SignalSide } from "@/lib/run/signals"
import type { SequenceAnalysis } from "./sequenceAnalysis"

export type BehavioralLabel = "HOT" | "COLD" | "SPURT" | "SWING" | "SET"

export type BehavioralState = {
  label: BehavioralLabel
  side: SignalSide | "neutral"
  score: number
  pressure: number
  density: number
  continuity: number
  momentum: string
  interpretation: string
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function sideName(run: Run, side: SignalSide | "neutral") {
  if (side === "home") return run.home
  if (side === "away") return run.away

  return "Flow"
}

export function deriveBehavioralState(run: Run, analysis: SequenceAnalysis): BehavioralState {
  const pressure = clamp(
    analysis.clusteredMisses * 0.22 +
      Math.min(analysis.currentDroughtMs / 35_000, 1) * 0.38 +
      analysis.interruption * 0.24
  )
  const density = clamp(analysis.signalDensity * 0.7 + analysis.recency * 0.3)
  const continuity = analysis.continuity
  const weightedScore = clamp(
    analysis.frequency * 0.08 +
      analysis.recency * 0.24 +
      analysis.continuity * 0.2 +
      (1 - analysis.interruption) * 0.14 +
      density * 0.24
  )
  const side =
    analysis.unanswered.side !== "none"
      ? analysis.unanswered.side
      : analysis.continuitySide !== "none"
        ? analysis.continuitySide
        : "neutral"
  let label: BehavioralState["label"] = "SET"

  if (analysis.clusteredMisses >= 3 || analysis.currentDroughtMs >= 25_000) label = "COLD"
  else if (analysis.alternatingInstability >= 3 || analysis.interruption >= 0.65) label = "SWING"
  else if (analysis.unanswered.count >= 3 || (density >= 0.65 && continuity >= 0.45)) label = "SPURT"
  else if (analysis.windows.lastFiveSeconds.some((signal) => isPositiveSignal(signal.result))) {
    label = "HOT"
  }

  const owner = sideName(run, side)
  const momentum =
    label === "COLD"
      ? "Cold stretch"
      : label === "SWING"
        ? "Momentum swing"
        : label === "SPURT"
          ? `${owner} spurt`
          : label === "HOT"
            ? `${owner} hot`
            : "Flow set"
  const interpretation =
    label === "COLD"
      ? "Conversion stalled."
      : label === "SWING"
        ? "Control is changing."
        : label === "SPURT"
          ? "Signals are clustering."
          : label === "HOT"
            ? "Recent positive pressure."
            : "Awaiting a shift."

  return {
    label,
    side,
    score: weightedScore,
    pressure,
    density,
    continuity,
    momentum,
    interpretation,
  }
}
