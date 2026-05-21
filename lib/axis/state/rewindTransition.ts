import {
  compactAxisEventLog,
  findLastSourceEvent,
  type AxisChronologyEvent,
  type AxisSourceEvent,
} from "@/lib/axis/state/eventLog"

export type AxisRewindTransition =
  | {
      kind: "undo_last"
      query: string
    }
  | {
      kind: "remove_stat"
      stat: "turnover" | "rebound" | "assist" | "foul" | "stop"
      query: string
    }
  | {
      kind: "replace_score_value"
      points: 1 | 2 | 3
      query: string
    }
  | {
      kind: "replace_player"
      playerId: string
      query: string
    }

export type AxisRewindResult = {
  events: AxisChronologyEvent[]
  transitionEvent: AxisChronologyEvent | null
  targetEventId: string | null
}

export function rewindTransition(events: AxisChronologyEvent[], transition: AxisRewindTransition): AxisRewindResult {
  const target = findRewindTarget(events, transition)
  if (!target) {
    return {
      events,
      transitionEvent: null,
      targetEventId: null,
    }
  }

  if (transition.kind === "undo_last" || transition.kind === "remove_stat") {
    const transitionEvent: AxisChronologyEvent = {
      id: `rewind-${Date.now().toString(36)}`,
      type: "event.removed",
      createdAt: new Date().toISOString(),
      gameTime: target.gameTime,
      period: target.period,
      source: "rail",
      query: transition.query,
      targetEventId: target.id,
      reason: transition.query,
    }

    return {
      events: [...events, transitionEvent],
      transitionEvent,
      targetEventId: target.id,
    }
  }

  const replacement = replaceTarget(target, transition)
  const transitionEvent: AxisChronologyEvent = {
    id: `correct-${Date.now().toString(36)}`,
    type: "event.corrected",
    createdAt: new Date().toISOString(),
    gameTime: target.gameTime,
    period: target.period,
    source: "rail",
    query: transition.query,
    targetEventId: target.id,
    replacement,
    reason: transition.query,
  }

  return {
    events: [...events, transitionEvent],
    transitionEvent,
    targetEventId: target.id,
  }
}

export function parseRewindTransition(query: string): AxisRewindTransition | null {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return null

  if (/^(undo|undo last|take it back|remove last)$/.test(normalized)) {
    return {
      kind: "undo_last",
      query,
    }
  }

  if (/\bremove\b.*\bturnover\b|\bno turnover\b/.test(normalized)) {
    return {
      kind: "remove_stat",
      stat: "turnover",
      query,
    }
  }

  if (/\bremove\b.*\brebound\b|\bno rebound\b/.test(normalized)) {
    return {
      kind: "remove_stat",
      stat: "rebound",
      query,
    }
  }

  const scoreCorrection = normalized.match(/\bactually\s+(1|2|3)\b|\bthat was\s+(1|2|3)\b/)
  if (scoreCorrection) {
    return {
      kind: "replace_score_value",
      points: Number(scoreCorrection[1] ?? scoreCorrection[2]) as 1 | 2 | 3,
      query,
    }
  }

  const playerCorrection = normalized.match(/\bwrong player\b.*?(#\d+|[a-z]+)?$/)
  if (playerCorrection) {
    return {
      kind: "replace_player",
      playerId: playerCorrection[1] || "Player",
      query,
    }
  }

  return null
}

function findRewindTarget(events: AxisChronologyEvent[], transition: AxisRewindTransition): AxisSourceEvent | null {
  if (transition.kind === "remove_stat") {
    return findLastSourceEvent(
      events,
      (event) => event.type === "stat.recorded" && event.stat === transition.stat,
    )
  }

  if (transition.kind === "replace_score_value") {
    return findLastSourceEvent(events, (event) => event.type === "score.recorded")
  }

  if (transition.kind === "replace_player") {
    return findLastSourceEvent(events, (event) => "playerId" in event || event.type === "memory.recorded")
  }

  return compactAxisEventLog(events).at(-1) ?? null
}

function replaceTarget(target: AxisSourceEvent, transition: Exclude<AxisRewindTransition, { kind: "undo_last" | "remove_stat" }>): AxisSourceEvent {
  if (transition.kind === "replace_score_value" && target.type === "score.recorded") {
    return {
      ...target,
      points: transition.points,
    }
  }

  if (transition.kind === "replace_player") {
    if (target.type === "memory.recorded") {
      return {
        ...target,
        playerIds: [transition.playerId],
      }
    }

    if ("playerId" in target) {
      return {
        ...target,
        playerId: transition.playerId,
      }
    }
  }

  return target
}
