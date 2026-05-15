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
  timeline?: {
    time: string
    label: string
    detail: string
    tone?: "lime" | "cyan" | "zinc"
  }[]
  ambientLine?: string
  memoryState?: MemoryState
}

function metadataNumber(
  metadata: Record<string, unknown> | null,
  key: string,
  fallback: number
) {
  const value = metadata?.[key]

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback
}

function metadataString(
  metadata: Record<string, unknown> | null,
  key: string,
  fallback: string
) {
  const value = metadata?.[key]

  return typeof value === "string" && value.length > 0
    ? value
    : fallback
}

function metadataTimeline(metadata: Record<string, unknown> | null) {
  const value = metadata?.timeline

  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null

      const record = item as Record<string, unknown>

      return {
        time:
          typeof record.time === "string"
            ? record.time
            : "00:00",
        label:
          typeof record.label === "string"
            ? record.label
            : "SIGNAL FOUND",
        detail:
          typeof record.detail === "string"
            ? record.detail
            : "Session memory expanded.",
      }
    })
    .filter((item): item is {
      time: string
      label: string
      detail: string
    } => Boolean(item))
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
    tags: session.tags || [],
    memoryCount: metadataNumber(session.metadata, "memoryCount", 1),
    lastSignal: metadataString(
      session.metadata,
      "lastSignal",
      "MEMORY STORED"
    ),
    archiveStatus: metadataString(
      session.metadata,
      "archiveStatus",
      "ACTIVE"
    ),
    context: metadataString(
      session.metadata,
      "context",
      "Replay linked. Session added. Memory available."
    ),
    timeline: metadataTimeline(session.metadata),
    ambientLine: metadataString(
      session.metadata,
      "ambientLine",
      "Memory online."
    ),
  }
}
