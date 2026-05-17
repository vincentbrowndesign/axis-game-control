import type { CalibrationBaseline } from "@/lib/calibration/types"
import type { ExtractedReplaySignals } from "@/lib/signals/types"

export type SessionSource = "camera" | "upload"

export type SessionEnvironment =
  | "game"
  | "practice"
  | "mission"
  | "workout"

export type StressPhase = "Block" | "Guided" | "Scrimmage" | "Game Ready"

export type ConstructionZoneStatus = "Active" | "Stabilizing" | "Cleared"

export type EnvironmentalConstraint =
  | "2 dribbles max"
  | "Weak hand only"
  | "No middle drive"
  | "One-touch finish"
  | "No retreat dribble"
  | "Reject screen"
  | "Automatic kick on slot drive"
  | "Tag before closeout"
  | "Stop ball first"

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
  player_id: string | null
  created_at: string
  updated_at: string
  title: string | null
  video_url: string | null
  file_name: string | null
  playback_id: string | null
  asset_id: string | null
  mux_playback_id: string | null
  mux_asset_id: string | null
  upload_id: string | null
  file_path: string | null
  source: SessionSource | null
  mission: string | null
  player_name: string | null
  behavior_sentence: string | null
  environment: SessionEnvironment | null
  duration_seconds: number | null
  status: string | null
  tags: string[] | null
  transcript_text: string | null
  ai_summary: string | null
  embedding_status: string | null
  semantic_tags: string[] | null
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

export type CorrectionTimelineEvent = {
  id: string
  type:
    | "CLIP_CAPTURED"
    | "FLAW_TAGGED"
    | "CORRECTION_ADDED"
    | "TRIGGER_ASSIGNED"
    | "CONSTRAINT_ADDED"
    | "REPEAT_MARKED"
    | "RETRIEVED"
    | "STRESS_PHASE_CHANGED"
    | "CONSTRUCTION_CHANGED"
    | "TRANSFER_OBSERVED"
    | "RELAPSE_OBSERVED"
  at: string
  detail: string
}

export type ReplaySessionView = {
  id: string
  createdAt: number
  source: SessionSource
  videoUrl: string
  title: string
  mission: string
  playerId?: string
  player: string
  environment: SessionEnvironment
  duration?: number
  status?: string
  fileName?: string
  muxAssetId?: string
  muxPlaybackId?: string
  behaviorSentence?: string
  tags: string[]
  transcriptText?: string
  aiSummary?: string
  embeddingStatus?: string
  semanticTags?: string[]
  situation?: string
  constraint?: string
  coachNote?: string
  coachFlaw?: string
  coachCorrection?: string
  triggerWord?: string
  repeatTomorrow?: boolean
  constructionZone?: boolean
  constructionZoneStatus?: ConstructionZoneStatus
  stressPhase?: StressPhase
  correctionTimelineEvents?: CorrectionTimelineEvent[]
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
