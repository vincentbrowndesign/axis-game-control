import type { ReplayMoment } from "@/lib/replay/types"
import type { RunState } from "@/lib/runs/types"
import type { TimelineEvent } from "@/lib/timeline/types"

export type SessionMode = "GAME" | "REP"

export type TeamSide = "LEFT" | "RIGHT"

export type TimelineEventType = "MAKE" | "MISS" | "SCORE"

export type SessionMetrics = {
  attempts: number
  makes: number
  misses: number
  makeRate: number
  makesPerMinute: number
  attemptsPerMinute: number
  avgInterval: number
  makeStreak: number
  missStreak: number
  heatWindow: {
    makes: number
    seconds: number
  }
  droughtSeconds: number
  earlyRate: number
  lateRate: number
  dropoff: number
  rushChange: number
  rhythmWindow: string
}

export type SessionPlayback = {
  replayId?: string
  videoUrl?: string
  fileName?: string
  durationSeconds: number
}

export type SessionState = {
  sessionId: string
  mode: SessionMode
  sessionName: string
  createdAt: number
  updatedAt: number
  leftLabel?: string
  rightLabel?: string
  leftScore?: number
  rightScore?: number
  makes?: number
  misses?: number
  clockMs: number
  clockRunning: boolean
  clockEnabled: boolean
  period?: number
  periodLengthMs?: number
  targetMakes?: number
  timeline: TimelineEvent[]
  replayMoments: ReplayMoment[]
  metrics: SessionMetrics
  runState: RunState
  playback: SessionPlayback
}

export type GameSetupInput = {
  mode: "GAME"
  sessionName: string
  leftLabel: string
  rightLabel: string
  startingLeftScore: number
  startingRightScore: number
  clockEnabled: boolean
  periodLengthMinutes?: number
}

export type RepSetupInput = {
  mode: "REP"
  drillName: string
  durationMinutes: number
  targetMakes?: number
  clockEnabled: boolean
}

export type SessionSetupInput = GameSetupInput | RepSetupInput

export type SessionEventInput =
  | {
      type: "SCORE"
      side: TeamSide
      points: 1 | 2 | 3
      replayTimestamp: number
    }
  | {
      type: "MAKE" | "MISS"
      replayTimestamp: number
    }
