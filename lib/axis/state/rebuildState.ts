import type { AxisMode, AxisStaticOutputs, AxisTeam, AxisMemoryObject } from "@/lib/axis/types"
import {
  compactAxisEventLog,
  sortAxisEvents,
  type AxisChronologyEvent,
  type AxisSourceEvent,
} from "@/lib/axis/state/eventLog"
import { recalculateContinuity, type AxisContinuityState } from "@/lib/axis/state/recalculateContinuity"
import { rebuildReplayChronology, type AxisReplayChronology } from "@/lib/axis/state/replayChronology"

export type AxisRebuiltState = {
  mode: AxisMode
  score: {
    home: number
    away: number
  }
  possession: AxisTeam
  possessionCount: number
  eventCount: number
  memories: AxisMemoryObject[]
  staticOutputs: AxisStaticOutputs
  continuity: AxisContinuityState
  replayChronology: AxisReplayChronology
}

export type AxisRebuildOptions = {
  mode?: AxisMode
  initialScore?: {
    home: number
    away: number
  }
  initialPossession?: AxisTeam
}

export function rebuildState(events: AxisChronologyEvent[], options: AxisRebuildOptions = {}): AxisRebuiltState {
  const sourceEvents = compactAxisEventLog(sortAxisEvents(events))
  const score = { home: options.initialScore?.home ?? 0, away: options.initialScore?.away ?? 0 }
  let possession = options.initialPossession ?? "home"
  let possessionCount = 0
  const players = new Map<string, AxisStaticOutputs["players"][number]>()
  const memories: AxisMemoryObject[] = []

  for (const event of sourceEvents) {
    if (event.type === "possession.changed") {
      possession = event.team
      possessionCount += 1
    }

    if (event.type === "score.initialized") {
      score.home = event.score.home
      score.away = event.score.away
    }

    if (event.type === "score.recorded") {
      score[event.team] += event.points
      const playerId = event.playerId ?? teamLabel(event.team)
      const line = getPlayerLine(players, playerId)
      line.points += event.points
      players.set(playerId, line)
      memories.push(memoryFromEvent(event, `${teamLabel(event.team)} ${event.points}`, `${score.home}-${score.away}`, ["scoring"]))
    }

    if (event.type === "stat.recorded") {
      const playerId = event.playerId ?? (event.team ? teamLabel(event.team) : "Team")
      const line = getPlayerLine(players, playerId)
      if (event.stat === "rebound") line.rebounds += 1
      if (event.stat === "assist") line.assists += 1
      if (event.stat === "turnover") line.turnovers += 1
      if (event.stat === "foul") line.fouls += 1
      players.set(playerId, line)
      memories.push(memoryFromEvent(event, statLabel(event), `${score.home}-${score.away}`, [event.stat]))
    }

    if (event.type === "memory.recorded") {
      for (const playerId of event.playerIds) {
        const line = getPlayerLine(players, playerId)
        if (event.tags.includes("scoring")) line.points += inferPointValue(event.label)
        if (event.tags.includes("rebound")) line.rebounds += 1
        if (event.tags.includes("assist")) line.assists += 1
        if (event.tags.includes("turnover")) line.turnovers += 1
        if (event.tags.includes("foul")) line.fouls += 1
        players.set(playerId, line)
      }

      memories.push({
        id: event.id,
        label: event.label,
        timestamp: event.gameTime,
        scoreState: event.scoreState,
        playerIds: event.playerIds,
        eventLabel: event.tags[0] ?? "memory",
        replayAnchor: event.tags.includes("replay") ? event.id : null,
        tags: event.tags,
      })
    }
  }

  const replayChronology = rebuildReplayChronology(sourceEvents, memories)
  const continuity = recalculateContinuity(memories)

  return {
    mode: options.mode ?? "memory",
    score,
    possession,
    possessionCount: Math.max(possessionCount, sourceEvents.length ? 1 : 0),
    eventCount: sourceEvents.length,
    memories,
    staticOutputs: {
      score,
      possession,
      possessionCount: Math.max(possessionCount, sourceEvents.length ? 1 : 0),
      eventCount: sourceEvents.length,
      players: Array.from(players.values()),
    },
    continuity,
    replayChronology,
  }
}

function memoryFromEvent(event: AxisSourceEvent, label: string, scoreState: string, tags: string[]): AxisMemoryObject {
  return {
    id: event.id,
    label,
    timestamp: event.gameTime,
    scoreState,
    playerIds: "playerId" in event && event.playerId ? [event.playerId] : "team" in event && event.team ? [teamLabel(event.team)] : [],
    eventLabel: tags[0] ?? "memory",
    replayAnchor: null,
    tags,
  }
}

function getPlayerLine(players: Map<string, AxisStaticOutputs["players"][number]>, id: string) {
  return (
    players.get(id) ?? {
      id,
      label: id,
      points: 0,
      rebounds: 0,
      assists: 0,
      turnovers: 0,
      fouls: 0,
    }
  )
}

function statLabel(event: Extract<AxisSourceEvent, { type: "stat.recorded" }>) {
  const player = event.playerId ?? (event.team ? teamLabel(event.team) : "Team")
  if (event.stat === "stop") return `${player} stop`
  return `${player} ${event.stat}`
}

function teamLabel(team: AxisTeam) {
  return team === "home" ? "Home" : "Away"
}

function inferPointValue(label: string) {
  return /\b3\b|three|right side/i.test(label) ? 3 : 2
}
