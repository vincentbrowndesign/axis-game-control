import type { TeamSide, TimelineEventType } from "@/lib/session/types"

export type TimelineEvent = {
  id: string
  type: TimelineEventType
  points?: 1 | 2 | 3
  side?: TeamSide
  sideLabel?: string
  timestampMs: number
  gameClock: string
  period?: number
  createdAt: number
  replayTimestamp: number
  sessionId: string
  replayRef?: string
  label: string
}
