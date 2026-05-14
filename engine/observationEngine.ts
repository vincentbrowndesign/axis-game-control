import { AxisEvent, AxisObservation } from "@/types/axis"

function count(events: AxisEvent[], type: string) {
  return events.filter((event) => event.type === type).length
}

function hasSequence(
  events: AxisEvent[],
  sequence: string[]
) {
  let index = 0

  for (const event of events) {
    if (event.type === sequence[index]) {
      index++
    }

    if (index === sequence.length) return true
  }

  return false
}

export function generateObservations(
  events: AxisEvent[]
): AxisObservation[] {
  const observations: AxisObservation[] = []

  const possessions = Math.max(
    count(events, "SHOT") + count(events, "TURNOVER"),
    1
  )

  const paintTouches = count(events, "PAINT_TOUCH")
  const shots = count(events, "SHOT")
  const makes = count(events, "MAKE")
  const turnovers = count(events, "TURNOVER")
  const drives = count(events, "DRIVE")
  const openEvents = count(events, "OPEN")

  if (paintTouches > 0 && shots > 0) {
    const rate = (paintTouches / possessions) * 100

    observations.push({
      id: "paint-touch-shot-quality",
      title: "Paint touches are shaping shot quality.",
      proof: `${paintTouches}/${possessions} possessions reached paint pressure before the possession ended.`,
      why:
        "Paint pressure forces the defense to react. When the defense reacts, cleaner windows become easier to find.",
      confidence: Math.min(94, 65 + rate),
    })
  }

  if (
    hasSequence(events, [
      "DRIVE",
      "HELP",
      "OPEN",
      "SHOT",
    ])
  ) {
    observations.push({
      id: "help-created-window",
      title: "Your best windows are coming before help fully recovers.",
      proof:
        "Axis found drive → help → open → shot inside this sequence.",
      why:
        "That means the advantage came from timing. The shot window existed before the second defender recovered.",
      confidence: 88,
    })
  }

  if (turnovers > 0) {
    const turnoverRate = (turnovers / possessions) * 100

    observations.push({
      id: "turnover-pressure",
      title: "Possessions are breaking when pressure wins the timing.",
      proof: `${turnovers}/${possessions} possessions ended in a turnover.`,
      why:
        "Axis is watching for moments where the ball stops moving before the defense finishes rotating.",
      confidence: Math.min(90, 60 + turnoverRate),
    })
  }

  if (drives > 0 && openEvents > 0) {
    observations.push({
      id: "drive-window",
      title: "Drives are creating visible windows.",
      proof: `${drives} drive events connected with ${openEvents} open-window events.`,
      why:
        "This is the start of an advantage profile: pressure applied, defense moved, window appeared.",
      confidence: 84,
    })
  }

  if (shots > 0) {
    const makeRate = shots ? (makes / shots) * 100 : 0

    observations.push({
      id: "shot-outcome",
      title: "Shot outcomes are now connected to the sequence.",
      proof: `${makes}/${shots} shots were marked as makes.`,
      why:
        "The goal is not just tracking makes. The goal is learning what happened before the make or miss.",
      confidence: makeRate > 0 ? 80 : 68,
    })
  }

  return observations
}
