import type { BasketballEvent, ContinuityAssistSample } from "@/lib/continuityAssistance"
import {
  trainingSignalFromTap,
  type AxisGameAction,
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

export type LiveScoringInput = {
  action: AxisGameAction
  type: BasketballEvent
  label: string
  points: number
  made: boolean | null
  assisted?: boolean
  foulLinked?: boolean
  possessionChange?: boolean
}

export const liveScoringInputs: LiveScoringInput[] = [
  {
    action: "MAKE_1",
    type: "MAKE",
    label: "1 FT",
    points: 1,
    made: true,
  },
  {
    action: "MAKE_2",
    type: "MAKE",
    label: "2PT",
    points: 2,
    made: true,
    possessionChange: true,
  },
  {
    action: "MAKE_3",
    type: "MAKE",
    label: "3PT",
    points: 3,
    made: true,
    possessionChange: true,
  },
  {
    action: "MISS_2",
    type: "MISS",
    label: "Miss 2",
    points: 0,
    made: false,
  },
  {
    action: "MISS_3",
    type: "MISS",
    label: "Miss 3",
    points: 0,
    made: false,
  },
  {
    action: "AND_1",
    type: "MAKE",
    label: "And 1",
    points: 2,
    made: true,
    foulLinked: true,
  },
  {
    action: "ASSIST",
    type: "ASSIST",
    label: "Ast",
    points: 0,
    made: null,
    assisted: true,
  },
  {
    action: "REBOUND",
    type: "REBOUND",
    label: "Reb",
    points: 0,
    made: null,
  },
  {
    action: "TURNOVER",
    type: "TURNOVER",
    label: "TO",
    points: 0,
    made: null,
    possessionChange: true,
  },
  {
    action: "STEAL",
    type: "STEAL",
    label: "Stl",
    points: 0,
    made: null,
    possessionChange: true,
  },
  {
    action: "BLOCK",
    type: "BLOCK",
    label: "Blk",
    points: 0,
    made: null,
  },
  {
    action: "FOUL",
    type: "FOUL",
    label: "Foul",
    points: 0,
    made: null,
  },
]

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

export function liveScoringInputForAction(action: AxisGameAction) {
  return liveScoringInputs.find((input) => input.action === action) || liveScoringInputs[1]
}

export function oppositeTeam(team: LiveStatTeam): LiveStatTeam {
  return team === "home" ? "away" : "home"
}

export function statDeltaForBasketballEvent(type: BasketballEvent, points = 0): LiveBoxScoreLine {
  const delta = createLine()

  if (type === "MAKE") {
    delta.points = points
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
  const delta = statDeltaForBasketballEvent(event.type, event.scoreValue)
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
  if (type === "MAKE") return points === 1 ? "made free throw" : `made ${points}PT shot`
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
  input,
  possessionBefore,
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
  input?: LiveScoringInput
  possessionBefore: LiveStatTeam
}): LiveBasketballStatEvent {
  const normalizedInput = input || liveScoringInputForAction(type === "MAKE" ? "MAKE_2" : type as AxisGameAction)
  const delta = statDeltaForBasketballEvent(type, normalizedInput.points)
  const scoreAfter = {
    home: scoreBefore.home.points + (team === "home" ? delta.points : 0),
    away: scoreBefore.away.points + (team === "away" ? delta.points : 0),
  }
  const possession = normalizedInput.possessionChange ? oppositeTeam(possessionBefore) : possessionBefore
  const label = player?.trim() || team.toUpperCase()
  const suffix = normalizedInput.foulLinked ? " + foul" : normalizedInput.assisted ? " linked assist" : ""
  const playByPlay = `${label} ${eventPhrase(type, delta.points)}${suffix}`

  return {
    id,
    sessionId,
    type,
    action: normalizedInput.action,
    team,
    player: player?.trim() || null,
    timestamp: sessionTime,
    points: delta.points,
    scoreValue: delta.points,
    made: normalizedInput.made,
    assisted: Boolean(normalizedInput.assisted),
    foulLinked: Boolean(normalizedInput.foulLinked),
    possession,
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
