import type { AxisReplayAnchor } from "@/lib/axisEventModel"
import type { TemporalReplayWindow } from "@/lib/temporalEventGraph"

export type AxisMemoryTeam = "HOME" | "AWAY"

export type AxisMemoryScoreState = {
  home: number
  away: number
}

export type AxisMemoryReplayWindow = TemporalReplayWindow & {
  clipStart: number
  clipEnd: number
}

export type AxisMemoryConfidenceLevel =
  | "human_confirmed"
  | "ai_inferred"
  | "unresolved"
  | "vision_assisted"

export type AxisMemoryCreatedBy =
  | "conversation"
  | "operator"
  | "system"
  | "vision"

export type AxisMemoryObject = {
  eventId: string
  sessionId: string
  timestamp: number
  gameClock: string | null
  quarter: number | null
  team: AxisMemoryTeam | null
  player: string | null
  eventType: string
  scoreBefore: AxisMemoryScoreState | null
  scoreAfter: AxisMemoryScoreState | null
  possessionBefore: AxisMemoryTeam | null
  possessionAfter: AxisMemoryTeam | null
  replayAnchor: AxisReplayAnchor | null
  replayWindow: AxisMemoryReplayWindow | null
  rawInput: string
  normalizedMeaning: string
  createdBy: AxisMemoryCreatedBy
  confidenceLevel: AxisMemoryConfidenceLevel
  previousEventId: string | null
  nextEventId: string | null
  semanticTags: string[]
  continuityState: Record<string, unknown> | null
  spatialMetadata: Record<string, unknown> | null
  cvMetadata: Record<string, unknown> | null
  movementMetadata: Record<string, unknown> | null
}

export function axisMemoryTeam(team: string | null | undefined): AxisMemoryTeam | null {
  const normalized = team?.trim().toUpperCase()
  if (normalized === "HOME" || normalized === "AWAY") return normalized
  return null
}

export function axisReplayWindowFromAnchor(
  anchor: AxisReplayAnchor | null,
  fallback?: TemporalReplayWindow
): AxisMemoryReplayWindow | null {
  if (!anchor) return null

  const before = fallback?.before ?? Math.max(0, anchor.sessionTime - anchor.clipStart)
  const after = fallback?.after ?? Math.max(0, anchor.clipEnd - anchor.sessionTime)

  return {
    before,
    after,
    clipStart: anchor.clipStart,
    clipEnd: anchor.clipEnd,
  }
}

export function createAxisMemoryObject(input: Omit<AxisMemoryObject, "nextEventId"> & {
  nextEventId?: string | null
}): AxisMemoryObject {
  return {
    ...input,
    nextEventId: input.nextEventId ?? null,
  }
}

export function appendAxisMemoryObject(
  timeline: AxisMemoryObject[],
  memoryObject: AxisMemoryObject,
  limit = 240
): AxisMemoryObject[] {
  const previous = timeline.at(-1) || null
  const linkedMemoryObject = {
    ...memoryObject,
    previousEventId: previous?.eventId || memoryObject.previousEventId,
  }

  if (!previous) return [linkedMemoryObject]

  return [
    ...timeline.slice(0, -1),
    {
      ...previous,
      nextEventId: linkedMemoryObject.eventId,
    },
    linkedMemoryObject,
  ].slice(-limit)
}
