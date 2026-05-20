import type { BasketballEvent, ContinuityAssistSample } from "@/lib/continuityAssistance"
import {
  trainingSignalFromTap,
  type AxisGameEvent,
} from "@/lib/axisEventModel"

export type LiveStatTeam = "home" | "away"

export type LiveBoxScoreLine = {
  points: number
  makes: number
  misses: number
  assists: number
  rebounds: number
  turnovers: number
  steals: number
  blocks: number
  fouls: number
}

export type LiveBoxScore = Record<LiveStatTeam, LiveBoxScoreLine>

export type LiveBasketballStatEvent = AxisGameEvent

const emptyLine: LiveBoxScoreLine = {
  points: 0,
  makes: 0,
  misses: 0,
  assists: 0,
  rebounds: 0,
  turnovers: 0,
  steals: 0,
  blocks: 0,
  fouls: 0,
}

function createLine(): LiveBoxScoreLine {
  return {
    ...emptyLine,
  }
}

export function createLiveBoxScore(): LiveBoxScore {
  return {
    home: createLine(),
    away: createLine(),
  }
}

export function statDeltaForBasketballEvent(type: BasketballEvent): LiveBoxScoreLine {
  const delta = createLine()

  if (type === "MAKE") {
    delta.points = 2
    delta.makes = 1
  } else if (type === "MISS" || type === "SHOT") {
    delta.misses = 1
  } else if (type === "ASSIST") {
    delta.assists = 1
  } else if (type === "REBOUND") {
    delta.rebounds = 1
  } else if (type === "TURNOVER") {
    delta.turnovers = 1
  } else if (type === "STEAL") {
    delta.steals = 1
  } else if (type === "BLOCK") {
    delta.blocks = 1
  } else if (type === "FOUL") {
    delta.fouls = 1
  }

  return delta
}

export function applyLiveStatEvent(score: LiveBoxScore, event: LiveBasketballStatEvent) {
  const next: LiveBoxScore = {
    home: {
      ...score.home,
    },
    away: {
      ...score.away,
    },
  }
  const delta = statDeltaForBasketballEvent(event.type)
  const line = next[event.team]

  line.points += delta.points
  line.makes += delta.makes
  line.misses += delta.misses
  line.assists += delta.assists
  line.rebounds += delta.rebounds
  line.turnovers += delta.turnovers
  line.steals += delta.steals
  line.blocks += delta.blocks
  line.fouls += delta.fouls

  return next
}

export function scoreFromLiveBoxScore(score: LiveBoxScore) {
  return {
    home: score.home.points,
    away: score.away.points,
  }
}

function eventPhrase(type: BasketballEvent, points: number) {
  if (type === "MAKE") return `made ${points}PT shot`
  if (type === "MISS" || type === "SHOT") return "missed shot"
  if (type === "ASSIST") return "assist"
  if (type === "REBOUND") return "rebound"
  if (type === "TURNOVER") return "turnover"
  if (type === "STEAL") return "steal"
  if (type === "BLOCK") return "block"
  if (type === "FOUL") return "foul"

  return type.toLowerCase()
}

export function createLiveBasketballStatEvent({
  id,
  sessionId,
  type,
  team,
  player,
  sessionTime,
  scoreBefore,
  snapshotId,
  sequenceIndex,
  previousEvents,
  continuity,
}: {
  id: string
  sessionId: string
  type: BasketballEvent
  team: LiveStatTeam
  player?: string | null
  sessionTime: number
  scoreBefore: LiveBoxScore
  snapshotId: string | null
  sequenceIndex: number
  previousEvents: BasketballEvent[]
  continuity: ContinuityAssistSample | null
}): LiveBasketballStatEvent {
  const delta = statDeltaForBasketballEvent(type)
  const scoreAfter = {
    home: scoreBefore.home.points + (team === "home" ? delta.points : 0),
    away: scoreBefore.away.points + (team === "away" ? delta.points : 0),
  }
  const label = player?.trim() || team.toUpperCase()
  const playByPlay = `${label} ${eventPhrase(type, delta.points)}`

  return {
    id,
    sessionId,
    type,
    team,
    player: player?.trim() || null,
    timestamp: sessionTime,
    points: delta.points,
    score: scoreAfter,
    replayAnchor: {
      sessionTime,
      clipStart: Math.max(0, sessionTime - 4),
      clipEnd: sessionTime + 4,
      snapshotId,
    },
    playByPlay,
    training: trainingSignalFromTap({
      sequenceIndex,
      previousEvents,
      replayPosition: sessionTime,
      scoreState: scoreAfter,
      continuity,
    }),
  }
}

export function summarizeLiveReport(events: LiveBasketballStatEvent[], score: LiveBoxScore) {
  const lastSix = events.slice(-6)
  const homeRun = lastSix.filter((event) => event.team === "home").reduce((total, event) => total + event.points, 0)
  const awayRun = lastSix.filter((event) => event.team === "away").reduce((total, event) => total + event.points, 0)
  const run =
    homeRun || awayRun
      ? `${homeRun}-${awayRun} last ${lastSix.length}`
      : `${lastSix.length} recent plays`

  return {
    score: `${score.home.points}-${score.away.points}`,
    run,
    rebounds: score.home.rebounds + score.away.rebounds,
    turnovers: score.home.turnovers + score.away.turnovers,
    keyMoments: lastSix.slice(-3).reverse(),
  }
}
