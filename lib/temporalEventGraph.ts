export type TemporalSessionStatus =
  | "READY"
  | "STARTING"
  | "LIVE"
  | "RECONNECTING"
  | "FINALIZING"
  | "ARCHIVED"
  | "FAILED"

export type TemporalEventType =
  | "MARK"
  | "SNAPSHOT"
  | "TIMEOUT"
  | "SYSTEM_RECONNECT"
  | "SESSION_STARTED"
  | "STREAM_CONNECTED"
  | "CHUNK_RECORDED"
  | "ARCHIVE_STARTED"
  | "ARCHIVE_COMPLETE"
  | "ARCHIVE_FAILED"

export type TemporalReplayWindow = {
  before: number
  after: number
}

export type TemporalEventPayload = {
  replay_window?: TemporalReplayWindow
  [key: string]: unknown
}

export type TemporalSessionRecord = {
  id: string
  operator_id: string | null
  status: TemporalSessionStatus
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  playback_url: string | null
  storage_path: string | null
  created_at: string
}

export type TemporalEventRecord = {
  id: string
  session_id: string
  type: TemporalEventType | string
  session_time: number
  sequence_order: number
  created_at: string
  payload: TemporalEventPayload
}

export type TemporalSnapshotRecord = {
  id: string
  session_id: string
  session_time: number
  image_url: string
  created_at: string
}

export function defaultReplayWindow(): TemporalReplayWindow {
  return {
    before: 8,
    after: 8,
  }
}
