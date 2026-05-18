import { continuityMultiplier } from "@/lib/engine/continuityEngine"
import {
  contextMultiplier,
  processMultiplier,
  type ActionContext,
  type ProcessGrade,
} from "@/lib/engine/processWeighting"
import { riskMultiplier, type MissRisk } from "@/lib/engine/transitionRisk"
import type { Run } from "@/lib/run/runState"
import {
  isNegativeSignal,
  isPositiveSignal,
  type RunSignal,
} from "@/lib/run/signals"

export type SystemEvent = {
  id: string
  team: "HOME" | "AWAY"
  outcome: "PLUS" | "MINUS"
  process: ProcessGrade
  context: ActionContext
  missRisk?: MissRisk
  timestamp: number
  value: number
}

export type SystemPlusMinus = {
  events: SystemEvent[]
  homeValue: number
  awayValue: number
  netValue: number
  structuralIntegrity: number
  pressure: number
  label: "STABLE FLOW" | "SPURT" | "HOT" | "COLD" | "SWING" | "BREAK"
  summary: string
}

function baseOutcome(signal: RunSignal) {
  return isPositiveSignal(signal.result) ? 1 : -1
}

function inferProcess(signals: RunSignal[], index: number): ProcessGrade {
  const signal = signals[index]
  const previous = signals[index - 1]
  if (!signal || !previous) return "NEUTRAL"
  if (isPositiveSignal(signal.result) && previous.side === signal.side) return "CORRECT"
  if (
    isNegativeSignal(signal.result) &&
    isNegativeSignal(previous.result) &&
    previous.side === signal.side
  ) {
    return "BROKEN"
  }

  return "NEUTRAL"
}

function inferContext(signals: RunSignal[], index: number): ActionContext {
  const signal = signals[index]
  const previous = signals[index - 1]
  if (!signal || !previous) return "NEUTRAL"

  const interval = signal.time - previous.time
  if (isPositiveSignal(signal.result) && previous.side === signal.side && interval <= 8_000) {
    return "ADVANTAGE"
  }
  if (
    isNegativeSignal(signal.result) &&
    isNegativeSignal(previous.result) &&
    interval <= 8_000
  ) {
    return "FORCED"
  }

  return "NEUTRAL"
}

function inferMissRisk(signals: RunSignal[], index: number): MissRisk | undefined {
  const signal = signals[index]
  const next = signals[index + 1]
  if (!signal || isPositiveSignal(signal.result)) return undefined
  if (!next) return "NORMAL"
  if (next.side !== signal.side && isPositiveSignal(next.result) && next.time - signal.time <= 8_000) {
    return "LIVE_BALL_RUNOUT"
  }
  if (next.side !== signal.side && next.time - signal.time <= 12_000) return "LIVE_BALL"

  return "NORMAL"
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

export function calculateSystemPlusMinus(run: Run): SystemPlusMinus {
  const signals = [...run.signals].sort((a, b) => a.time - b.time)
  const events = signals.map((signal, index) => {
    const process = inferProcess(signals, index)
    const context = inferContext(signals, index)
    const missRisk = inferMissRisk(signals, index)
    const outcome = isPositiveSignal(signal.result) ? "PLUS" : "MINUS"
    const value =
      baseOutcome(signal) *
      processMultiplier(process) *
      contextMultiplier(context) *
      continuityMultiplier(signals, index) *
      riskMultiplier(missRisk, outcome)

    return {
      id: signal.id,
      team: signal.side === "home" ? "HOME" : "AWAY",
      outcome,
      process,
      context,
      missRisk,
      timestamp: signal.time,
      value,
    } satisfies SystemEvent
  })
  const homeValue = events
    .filter((event) => event.team === "HOME")
    .reduce((total, event) => total + event.value, 0)
  const awayValue = events
    .filter((event) => event.team === "AWAY")
    .reduce((total, event) => total + event.value, 0)
  const negativeValue = Math.abs(
    events.filter((event) => event.value < 0).reduce((total, event) => total + event.value, 0)
  )
  const positiveValue = events
    .filter((event) => event.value > 0)
    .reduce((total, event) => total + event.value, 0)
  const structuralIntegrity = clamp(
    events.length ? positiveValue / Math.max(1, positiveValue + negativeValue) : 0.5
  )
  const audioEscalation = run.audioContext?.escalation ?? 0
  const pressure = clamp(
    negativeValue / Math.max(1, positiveValue + negativeValue) + audioEscalation * 0.18
  )
  const latest = events[events.length - 1]
  let label: SystemPlusMinus["label"] = "STABLE FLOW"

  if (pressure >= 0.72) label = "BREAK"
  else if (pressure >= 0.56) label = "COLD"
  else if (Math.abs(homeValue - awayValue) >= 3 && structuralIntegrity >= 0.62) label = "SPURT"
  else if (latest?.value && latest.value > 0) label = "HOT"
  else if (events.slice(-4).filter((event) => event.team !== latest?.team).length >= 2) label = "SWING"

  return {
    events,
    homeValue,
    awayValue,
    netValue: homeValue - awayValue,
    structuralIntegrity,
    pressure,
    label,
    summary:
      label === "BREAK"
        ? "Flow broke."
        : label === "COLD"
          ? "Pressure building."
          : label === "SPURT"
            ? "Run building."
            : label === "SWING"
              ? "Pressure shifted."
              : "Stable flow.",
  }
}
