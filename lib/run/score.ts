import type { Run, RunScoreEvent } from "@/lib/run/runState"

export function scoreFor(run: Pick<Run, "scoreEvents">) {
  return (run.scoreEvents ?? []).reduce(
    (score, event) => {
      if (event.team === "home") score.home += event.points
      else score.away += event.points

      return score
    },
    {
      home: 0,
      away: 0,
    }
  )
}

export function removeScoreEvent(
  scoreEvents: RunScoreEvent[] | undefined,
  eventId: string
) {
  return (scoreEvents ?? []).filter(
    (event) => event.id !== eventId && event.signalId !== eventId
  )
}
