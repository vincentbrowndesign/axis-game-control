import type { ProgressionSignal } from "@/lib/progression/types"
import type { ReplayMoment } from "@/lib/replay/types"
import type { Spurt } from "@/lib/spurts/types"
import type { TimelineEvent } from "@/lib/timeline/types"

export type StreamMetrics = {
  attempts: number
  makes: number
  misses: number
  makeRate: number
  makesPerMinute: number
  attemptsPerMinute: number
  elapsedMs: number
  avgIntervalSeconds: number
  intervalRange: string
  longestStreak: number
  longestDroughtSeconds: number
  bestSpurt: {
    makes: number
    seconds: number
  }
  emptySpurt: {
    misses: number
    seconds: number
  }
  rushAfterMissPct: number
}

export type Stream = {
  id: string
  label: string
  attempts: number
  makes: number
  misses: number
  metrics: StreamMetrics
}

export type SessionPlayback = {
  replayId?: string
  videoUrl?: string
  durationSeconds: number
  attachedAt?: number
}

export type SessionState = {
  sessionId: string
  sessionName: string
  createdAt: number
  updatedAt: number
  elapsedMs: number
  timerRunning: boolean
  activeStreamId: string
  streams: Stream[]
  timeline: TimelineEvent[]
  spurts: Spurt[]
  replayMoments: ReplayMoment[]
  progression: ProgressionSignal[]
  playback: SessionPlayback
}

export type SessionSetupInput = {
  sessionName: string
  streamLabels: string[]
}

export type SessionEventInput = {
  streamId: string
  type: "INCREMENT" | "DECREMENT"
  replayTimestamp: number
}

export type StoredSessionSummary = {
  sessionId: string
  sessionName: string
  completedAt: number
  streams: Array<{
    label: string
    metrics: StreamMetrics
  }>
}
