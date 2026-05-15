import type { CalibrationBaseline } from "@/lib/calibration/types"
import type { ExtractedReplaySignals } from "@/lib/signals/types"

export type SessionSource = "camera" | "upload"

export type SessionEnvironment =
  | "game"
  | "practice"
  | "mission"
  | "workout"

export type AxisProfile = {
  id: string
  user_id: string
  display_name: string | null
  player_name: string | null
  role: string | null
  created_at: string
  updated_at: string
}

export type AxisReplaySession = {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  title: string | null
  video_url: string | null
  file_name: string | null
  playback_id: string | null
  asset_id: string | null
  upload_id: string | null
  file_path: string | null
  source: SessionSource | null
  mission: string | null
  player_name: string | null
  environment: SessionEnvironment | null
  duration_seconds: number | null
  status: string | null
  tags: string[] | null
  metadata: Record<string, unknown> | null
}

export type MemoryTimelineEvent = {
  label: string
  time: string
  body: string
  tone: "lime" | "cyan" | "zinc"
}

export type MemoryState = {
  headline: string
  status: string
  ambientLine: string
  contextLine: string
  archiveStatus: string
  memoryCount: number
  timelineEvents: MemoryTimelineEvent[]
  confidence: number
}

export type ReplaySessionView = {
  id: string
  createdAt: number
  source: SessionSource
  videoUrl: string
  title: string
  mission: string
  player: string
  environment: SessionEnvironment
  duration?: number
  status?: string
  fileName?: string
  tags: string[]
  memoryCount?: number
  lastSignal?: string
  archiveStatus?: string
  context?: string
  contextLine?: string
  timeline?: {
    time: string
    label: string
    detail: string
    tone?: "lime" | "cyan" | "zinc"
  }[]
  timelineEvents?: MemoryTimelineEvent[]
  ambientLine?: string
  memoryState?: MemoryState
  signalRead?: ExtractedReplaySignals
  baseline?: CalibrationBaseline
}
