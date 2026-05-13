export type AxisEvent =
  | "SHOT"
  | "DRIVE"
  | "PASS"
  | "TURNOVER"
  | "REBOUND"
  | "FOUL"

export type AxisState =
  | "SHIFT"
  | "HELP"
  | "ADVANTAGE"
  | "ROTATE"
  | "SCRAMBLE"
  | "COLLAPSE"
  | "RECOVER"

export type TimelineEvent = {
  type: AxisEvent
  time: number

  defendersMoved?: number
  helpCommitted?: boolean
  paintTouched?: boolean
  rotationLate?: boolean
}

export function inferStates(
  events: TimelineEvent[]
): AxisState[] {
  const states = new Set<AxisState>()

  for (const event of events) {
    if (event.type === "DRIVE") {
      if (event.paintTouched) {
        states.add("ADVANTAGE")
      }

      if (event.helpCommitted) {
        states.add("HELP")
        states.add("SHIFT")
      }

      if (
        event.defendersMoved &&
        event.defendersMoved >= 2
      ) {
        states.add("COLLAPSE")
      }
    }

    if (event.rotationLate) {
      states.add("ROTATE")
    }
  }

  return Array.from(states)
}