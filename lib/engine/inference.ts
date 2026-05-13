import { AxisEvent } from "../game/types"

export interface AxisInference {
  liveState: string
  pressure: number
  pace: number
  momentum: number
  summary: string
}

export function inferPossession(
  events: AxisEvent[]
): AxisInference {
  if (!events.length) {
    return {
      liveState: "EMPTY",
      pressure: 0,
      pace: 0,
      momentum: 0,
      summary: "No events tracked.",
    }
  }

  const gaps = events
    .slice(1)
    .map((e) => e.gapFromPrevious)

  const avgGap =
    gaps.reduce((a, b) => a + b, 0) /
      (gaps.length || 1)

  const passes = events.filter(
    (e) => e.type === "PASS"
  ).length

  const drives = events.filter(
    (e) => e.type === "DRIVE"
  ).length

  const shots = events.filter(
    (e) => e.type === "SHOT"
  ).length

  const turnovers = events.filter(
    (e) => e.type === "TURNOVER"
  ).length

  let liveState = "STABLE"

  if (
    avgGap < 1 &&
    passes >= 2 &&
    drives >= 1
  ) {
    liveState = "FAST CASCADE"
  }

  if (turnovers >= 1) {
    liveState = "BROKEN POSSESSION"
  }

  if (avgGap > 3) {
    liveState = "STALL"
  }

  const pressure =
    drives * 2 + passes * 0.5

  const pace =
    avgGap < 1 ? 10 : avgGap < 2 ? 7 : 4

  const momentum =
    shots * 2 - turnovers * 3

  return {
    liveState,
    pressure,
    pace,
    momentum,
    summary:
      "Axis detected possession rhythm and inferred live pressure behavior.",
  }
}