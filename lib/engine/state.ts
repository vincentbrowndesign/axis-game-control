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
  signals: number
  run: number
  density: number
}

export type AxisState = {
  label: AxisStateLabel
  leader: SignalSide | "even"
  margin: number
  silenceMs: number
  home: SideState
  away: SideState
}

function emptySide(): SideState {
  return {
    signals: 0,
    run: 0,
    density: 0,
  }
}

function weightForAge(ageMs: number) {
  if (ageMs <= 5_000) return 2.4
  if (ageMs <= 20_000) return 1.25
  if (ageMs <= 60_000) return 0.55

  return 0.18
}

export function deriveAxisState(run: Run, elapsedMs?: number): AxisState {
  const home = emptySide()
  const away = emptySide()
  let homeControl = 0
  let awayControl = 0
  const latestTime = run.signals[run.signals.length - 1]?.time || 0
  const currentTime = elapsedMs ?? latestTime
  const silenceMs = Math.max(0, currentTime - latestTime)

  for (const signal of run.signals) {
    const side = signal.side === "home" ? home : away
    const weight = weightForAge(Math.max(0, currentTime - signal.time))

    side.signals += 1
    side.run += 1
    side.density += weight
    if (signal.side === "home") {
      homeControl += weight
      away.run = 0
    } else {
      awayControl += weight
      home.run = 0
    }
  }

  const margin = Math.round((homeControl - awayControl) * 10) / 10
  const recent = run.signals.slice(-5)
  const alternations = recent.filter(
    (signal, index) => index > 0 && signal.side !== recent[index - 1].side
  ).length
  const latestRun = recent.filter(
    (signal) => signal.side === run.signals[run.signals.length - 1]?.side
  ).length
  const leader: AxisState["leader"] =
    Math.abs(margin) < 1.1 ? "even" : margin > 0 ? "home" : "away"
  let label: AxisStateLabel = "EVEN"

  if (silenceMs >= 35_000 && run.signals.length) label = "BREAKING"
  else if (silenceMs >= 18_000 || alternations >= 3) label = "UNSTABLE"
  else if (alternations >= 2) label = "SHIFTING"
  else if (latestRun >= 3 && leader === "home") label = "HOME CONTROL"
  else if (latestRun >= 3 && leader === "away") label = "AWAY CONTROL"
  else if (leader === "home") label = "HOME CONTROL"
  else if (leader === "away") label = "AWAY CONTROL"

  if (run.signals.length === 0) label = "EVEN"

  return {
    label,
    leader,
    margin,
    silenceMs,
    home,
    away,
  }
}
