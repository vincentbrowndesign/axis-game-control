import type { TeamSide } from "@/lib/session/types"
import type { TimelineEvent } from "@/lib/timeline/types"
import type { RunState } from "@/lib/runs/types"

export function calculateRunState(events: TimelineEvent[]): RunState {
  const scoreEvents = events
    .filter((event) => event.type === "SCORE" && event.side && event.points)
    .slice(0, 8)

  if (!scoreEvents.length) {
    return {
      side: null,
      label: "RUN: 0-0",
      pointsFor: 0,
      pointsAgainst: 0,
    }
  }

  const totals = scoreEvents.reduce(
    (value, event) => {
      const side = event.side as TeamSide
      value[side] += event.points || 0

      return value
    },
    {
      LEFT: 0,
      RIGHT: 0,
    }
  )
  const side = totals.LEFT >= totals.RIGHT ? "LEFT" : "RIGHT"
  const pointsFor = totals[side]
  const pointsAgainst = side === "LEFT" ? totals.RIGHT : totals.LEFT

  return {
    side,
    label: `RUN: ${pointsFor}-${pointsAgainst}`,
    pointsFor,
    pointsAgainst,
  }
}
