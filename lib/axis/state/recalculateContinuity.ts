import type { AxisContextualOutputs, AxisMemoryObject } from "@/lib/axis/types"

export type AxisContinuityState = AxisContextualOutputs & {
  pressure: "settled" | "rising" | "swinging"
  unansweredRun: {
    team: "home" | "away"
    points: number
    startMemoryId: string | null
    endMemoryId: string | null
  } | null
}

export function recalculateContinuity(memories: AxisMemoryObject[]): AxisContinuityState {
  const chronological = [...memories]
  const scoring = chronological.filter((memory) => memory.tags.includes("scoring"))
  const stops = chronological.filter((memory) => memory.tags.includes("stop") || memory.tags.includes("turnover"))
  const rebounds = chronological.filter((memory) => memory.tags.includes("rebound"))
  const unansweredRun = calculateUnansweredRun(scoring)

  return {
    lastRun: unansweredRun
      ? `${memories.find((memory) => memory.id === unansweredRun.startMemoryId)?.timestamp ?? "now"} to ${
          memories.find((memory) => memory.id === unansweredRun.endMemoryId)?.timestamp ?? "now"
        }`
      : scoring.length >= 2
        ? `${scoring.at(-2)?.timestamp} to ${scoring.at(-1)?.timestamp}`
        : null,
    collapseWindow: stops.length >= 2 ? `${stops[0].timestamp} to ${stops.at(-1)?.timestamp}` : null,
    stabilizationMoment: rebounds[0]?.label ?? stops[0]?.label ?? null,
    pressureShift: stops[0]?.label ?? unansweredRun?.team ?? null,
    playerSequence: chronological.find((memory) => memory.playerIds.length)?.playerIds.join(", ") ?? null,
    continuityChain: chronological.slice(-5).map((memory) => memory.label),
    pressure: stops.length >= 2 || (unansweredRun?.points ?? 0) >= 5 ? "rising" : scoring.length >= 2 ? "swinging" : "settled",
    unansweredRun,
  }
}

function calculateUnansweredRun(scoring: AxisMemoryObject[]): AxisContinuityState["unansweredRun"] {
  let currentTeam: "home" | "away" | null = null
  let points = 0
  let startMemoryId: string | null = null
  let endMemoryId: string | null = null
  let best: AxisContinuityState["unansweredRun"] = null

  for (const memory of scoring) {
    const team = /\baway\b/i.test(memory.label) ? "away" : "home"
    const value = inferPointValue(memory.label)

    if (team !== currentTeam) {
      currentTeam = team
      points = value
      startMemoryId = memory.id
    } else {
      points += value
    }

    endMemoryId = memory.id

    if (points >= (best?.points ?? 0)) {
      best = {
        team,
        points,
        startMemoryId,
        endMemoryId,
      }
    }
  }

  return best && best.points >= 4 ? best : null
}

function inferPointValue(label: string) {
  return /\b3\b|three|right side/i.test(label) ? 3 : 2
}
