import { AxisEvent } from "../game/types"

export function buildRhythmStrip(
  events: AxisEvent[]
) {
  return events.map((event) => ({
    label: event.type,
    gap:
      event.gapFromPrevious.toFixed(1) +
      "s",
    intensity:
      event.gapFromPrevious < 1
        ? "FAST"
        : event.gapFromPrevious < 2
        ? "FLOW"
        : "SLOW",
  }))
}