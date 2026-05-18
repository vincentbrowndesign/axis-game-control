import type { Run } from "@/lib/run/runState"
import type { SignalSide } from "@/lib/run/signals"

export type AxisStateLabel =
  | "EVEN"
  | "HOME CONTROL"
  | "AWAY CONTROL"
  | "SHIFTING"
  | "UNSTABLE"
  | "BREAKING"

export type SideState = {
  attempts: number
  makes: number
  misses: number
  run: number
}

export type AxisState = {
  label: AxisStateLabel
  leader: SignalSide | "even"
  margin: number
  home: SideState
  away: SideState
}

function emptySide(): SideState {
  return {
    attempts: 0,
    makes: 0,
    misses: 0,
    run: 0,
  }
}

export function deriveAxisState(run: Run): AxisState {
  const home = emptySide()
  const away = emptySide()
  let homeControl = 0
  let awayControl = 0

  for (const signal of run.signals) {
    const side = signal.side === "home" ? home : away

    side.attempts += 1
    if (signal.result === "make") {
      side.makes += 1
      side.run += 1
      if (signal.side === "home") {
        homeControl += 1
        away.run = 0
      } else {
        awayControl += 1
        home.run = 0
      }
    } else {
      side.misses += 1
      side.run = Math.max(0, side.run - 1)
      if (signal.side === "home") homeControl -= 0.65
      if (signal.side === "away") awayControl -= 0.65
    }
  }

  const margin = Math.round((homeControl - awayControl) * 10) / 10
  const recent = run.signals.slice(-5)
  const recentMisses = recent.filter((signal) => signal.result === "miss").length
  const recentMakes = recent.filter((signal) => signal.result === "make").length
  const leader: AxisState["leader"] =
    Math.abs(margin) < 1 ? "even" : margin > 0 ? "home" : "away"
  let label: AxisStateLabel = "EVEN"

  if (recentMisses >= 4) label = "BREAKING"
  else if (recentMisses >= 3 || (recentMakes >= 2 && Math.abs(margin) <= 1)) {
    label = "UNSTABLE"
  } else if (recent.length >= 3 && recent.some((signal) => signal.side !== recent[0].side)) {
    label = "SHIFTING"
  } else if (leader === "home") label = "HOME CONTROL"
  else if (leader === "away") label = "AWAY CONTROL"

  return {
    label,
    leader,
    margin,
    home,
    away,
  }
}
