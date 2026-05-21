import type { AxisTeam } from "@/lib/axis/types"

export type AxisStoEventSource = "rail" | "api" | "replay" | "system"

export type AxisStoEventBase = {
  id: string
  type: string
  createdAt: string
  gameTime: string
  period: string
  source: AxisStoEventSource
  query?: string
}

export type AxisMemoryRecordedEvent = AxisStoEventBase & {
  type: "memory.recorded"
  label: string
  scoreState: string
  playerIds: string[]
  tags: string[]
}

export type AxisScoreInitializedEvent = AxisStoEventBase & {
  type: "score.initialized"
  score: {
    home: number
    away: number
  }
}

export type AxisScoreRecordedEvent = AxisStoEventBase & {
  type: "score.recorded"
  team: AxisTeam
  points: 1 | 2 | 3
  playerId?: string
}

export type AxisStatRecordedEvent = AxisStoEventBase & {
  type: "stat.recorded"
  stat: "rebound" | "assist" | "turnover" | "foul" | "stop"
  team?: AxisTeam
  playerId?: string
}

export type AxisPossessionChangedEvent = AxisStoEventBase & {
  type: "possession.changed"
  team: AxisTeam
}

export type AxisReplayAnchorCreatedEvent = AxisStoEventBase & {
  type: "replay.anchor.created"
  memoryId: string
  window: {
    start: string
    end: string
  }
}

export type AxisEventRemovedEvent = AxisStoEventBase & {
  type: "event.removed"
  targetEventId: string
  reason: string
}

export type AxisEventCorrectedEvent = AxisStoEventBase & {
  type: "event.corrected"
  targetEventId: string
  replacement: AxisSourceEvent
  reason: string
}

export type AxisSourceEvent =
  | AxisMemoryRecordedEvent
  | AxisScoreInitializedEvent
  | AxisScoreRecordedEvent
  | AxisStatRecordedEvent
  | AxisPossessionChangedEvent
  | AxisReplayAnchorCreatedEvent

export type AxisChronologyEvent = AxisSourceEvent | AxisEventRemovedEvent | AxisEventCorrectedEvent

export type AxisEventDraft =
  | Omit<AxisMemoryRecordedEvent, "id" | "createdAt" | "source" | "gameTime" | "period">
  | Omit<AxisScoreInitializedEvent, "id" | "createdAt" | "source" | "gameTime" | "period">
  | Omit<AxisScoreRecordedEvent, "id" | "createdAt" | "source" | "gameTime" | "period">
  | Omit<AxisStatRecordedEvent, "id" | "createdAt" | "source" | "gameTime" | "period">
  | Omit<AxisPossessionChangedEvent, "id" | "createdAt" | "source" | "gameTime" | "period">
  | Omit<AxisReplayAnchorCreatedEvent, "id" | "createdAt" | "source" | "gameTime" | "period">

export type AxisEventContext = {
  createdAt?: string
  gameTime?: string
  period?: string
  source?: AxisStoEventSource
  query?: string
}

export function createAxisEvent(draft: AxisEventDraft, context: AxisEventContext = {}): AxisSourceEvent {
  return {
    ...draft,
    id: nextEventId(),
    createdAt: context.createdAt ?? new Date().toISOString(),
    gameTime: context.gameTime ?? "now",
    period: context.period ?? "Q1",
    source: context.source ?? "rail",
    query: context.query,
  } as AxisSourceEvent
}

export function appendAxisEvent(events: AxisChronologyEvent[], event: AxisChronologyEvent): AxisChronologyEvent[] {
  return [...events, event]
}

export function sortAxisEvents(events: AxisChronologyEvent[]): AxisChronologyEvent[] {
  return [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function compactAxisEventLog(events: AxisChronologyEvent[]): AxisSourceEvent[] {
  const removed = new Set<string>()
  const replacements = new Map<string, AxisSourceEvent>()

  for (const event of sortAxisEvents(events)) {
    if (event.type === "event.removed") {
      removed.add(event.targetEventId)
      replacements.delete(event.targetEventId)
    }

    if (event.type === "event.corrected") {
      removed.delete(event.targetEventId)
      replacements.set(event.targetEventId, event.replacement)
    }
  }

  return sortAxisEvents(events).flatMap((event) => {
    if (event.type === "event.removed" || event.type === "event.corrected") return []
    if (removed.has(event.id)) return []
    return [replacements.get(event.id) ?? event]
  })
}

export function findLastSourceEvent(
  events: AxisChronologyEvent[],
  predicate: (event: AxisSourceEvent) => boolean = () => true,
): AxisSourceEvent | null {
  const compacted = compactAxisEventLog(events)
  for (let index = compacted.length - 1; index >= 0; index -= 1) {
    const event = compacted[index]
    if (predicate(event)) return event
  }
  return null
}

function nextEventId() {
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
