export type ReplayMarkerType =
  | "cadence"
  | "rhythm"
  | "reset"
  | "spurt"
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
  identityId: string
  identityLabel: string
  action: "MAKE" | "MISS"
  elapsedMs: number
  elapsedLabel: string
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
  eventType: "MAKE" | "MISS"
  label: string
  videoUrl?: string
  createdAt: number
}
