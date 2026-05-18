export type ReplayMarkerType =
  | "cadence"
  | "rhythm"
  | "reset"
  | "burst"
  | "repetition"
  | "continuity"
  | "stabilization"

export type ReplayMarker = {
  id: string
  label: string
  startTime: number
  endTime: number
  confidence: number
  type: ReplayMarkerType
}

export type ReplayAnchor = {
  id: string
  sessionId: string
  timelineEventId: string
  team: "left" | "right"
  teamName: string
  points: 1 | 2 | 3
  gameClock: string
  period: number
  replayTimestamp: number
  createdAt: number
  videoUrl?: string
}

export type ReplayMoment = {
  id: string
  sessionId: string
  eventId: string
  timestampMs: number
  replayTimestamp: number
  eventType: "MAKE" | "MISS" | "SCORE"
  label: string
  videoUrl?: string
  createdAt: number
}
