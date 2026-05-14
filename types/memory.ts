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
  metadata: Record<string, unknown> | null
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
}

export function mapReplaySession(
  session: AxisReplaySession
): ReplaySessionView {
  return {
    id: session.id,
    createdAt: new Date(session.created_at).getTime(),
    source: session.source || "upload",
    videoUrl: session.video_url || "",
    title: session.title || "Axis Session",
    mission: session.mission || "None",
    player: session.player_name || "Unassigned",
    environment: session.environment || "practice",
    duration: session.duration_seconds || 0,
    status: session.status || "stored",
    fileName: session.file_name || undefined,
  }
}
